const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { checkEmailConfig } = require('@librechat/api');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
const { SystemRoles } = require('librechat-data-provider');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { registerUser } = require('~/server/services/AuthService');
const { sendEmail } = require('~/server/utils');
const { askQuestion, silentExit } = require('./helpers');
const connect = require('./connect');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random password of a given length using alphanumeric + special chars.
 */
function generatePassword(length = 16) {
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return pw;
}

/**
 * Parse a CSV file. Expected columns: email, name, username, role
 * - First row is treated as a header if it starts with "email" (case-insensitive).
 * - Delimiter: comma or semicolon (auto-detected per line).
 * - Role is optional (defaults to USER).
 * - Empty lines and lines starting with # are skipped.
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));

  if (lines.length === 0) {
    return [];
  }

  let startIndex = 0;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.startsWith('email') || firstLine.startsWith('"email')) {
    startIndex = 1; // skip header
  }

  const users = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    // Auto-detect delimiter
    const delimiter = line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ''));

    const [email, name, username, role] = parts;

    if (!email || !email.includes('@')) {
      console.orange(`Warning: Skipping invalid line ${i + 1}: "${line}"`);
      continue;
    }

    users.push({
      email: email.trim(),
      name: (name || email.split('@')[0]).trim(),
      username: (username || email.split('@')[0]).trim(),
      role: role && Object.values(SystemRoles).includes(role.toUpperCase())
        ? role.toUpperCase()
        : SystemRoles.USER,
    });
  }

  return users;
}

/**
 * Print a formatted table of users to the console.
 */
function printUserTable(users) {
  // Calculate column widths
  const cols = {
    idx: 4,
    email: Math.max(6, ...users.map((u) => u.email.length)) + 2,
    name: Math.max(5, ...users.map((u) => u.name.length)) + 2,
    username: Math.max(9, ...users.map((u) => u.username.length)) + 2,
    role: Math.max(5, ...users.map((u) => u.role.length)) + 2,
    password: Math.max(9, ...users.map((u) => u.password.length)) + 2,
  };

  const sep = '-'.repeat(cols.idx + cols.email + cols.name + cols.username + cols.role + cols.password + 7);
  console.log(sep);
  console.log(
    '#'.padEnd(cols.idx) + ' | ' +
    'Email'.padEnd(cols.email) + ' | ' +
    'Name'.padEnd(cols.name) + ' | ' +
    'Username'.padEnd(cols.username) + ' | ' +
    'Role'.padEnd(cols.role) + ' | ' +
    'Password'.padEnd(cols.password),
  );
  console.log(sep);

  users.forEach((u, i) => {
    console.log(
      String(i + 1).padEnd(cols.idx) + ' | ' +
      u.email.padEnd(cols.email) + ' | ' +
      u.name.padEnd(cols.name) + ' | ' +
      u.username.padEnd(cols.username) + ' | ' +
      u.role.padEnd(cols.role) + ' | ' +
      u.password.padEnd(cols.password),
    );
  });

  console.log(sep);
}

/**
 * Save credentials to a CSV file.
 */
function saveCredentials(users, outputPath) {
  const header = 'email,name,username,role,password';
  const rows = users.map(
    (u) => `${u.email},${u.name},${u.username},${u.role},${u.password}`,
  );
  const content = [header, ...rows].join('\n') + '\n';
  fs.writeFileSync(outputPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  await connect();

  console.purple('==========================================');
  console.purple('  Bulk User Registration');
  console.purple('==========================================');

  // ---- Determine input file path ----
  let inputFile = process.argv[2];
  if (!inputFile) {
    console.orange('Usage: npm run bulk-register <path-to-csv>');
    console.orange('');
    console.orange('CSV format (comma or semicolon separated):');
    console.orange('  email, name, username, role');
    console.orange('');
    console.orange('Example (data/new-users.csv):');
    console.orange('  email,name,username,role');
    console.orange('  max@example.com,Max Mustermann,max,USER');
    console.orange('  anna@example.com,Anna Schmidt,anna,ADMIN');
    console.orange('');
    console.orange('Role is optional (defaults to USER). Valid: USER, MANAGER, ADMIN');
    console.purple('==========================================');
    inputFile = await askQuestion('Path to CSV file (or drag & drop):');
  }

  // Resolve path
  inputFile = inputFile.trim().replace(/^['"]|['"]$/g, '');
  if (!path.isAbsolute(inputFile)) {
    inputFile = path.resolve(process.cwd(), inputFile);
  }

  if (!fs.existsSync(inputFile)) {
    console.red(`Error: File not found: ${inputFile}`);
    silentExit(1);
  }

  // ---- Parse CSV ----
  const users = parseCSV(inputFile);
  if (users.length === 0) {
    console.red('Error: No valid users found in the CSV file!');
    silentExit(1);
  }

  console.green(`\nFound ${users.length} user(s) in the input file.\n`);

  // ---- Check for existing users ----
  const existingEmails = [];
  const existingUsernames = [];
  for (const u of users) {
    const existing = await User.findOne({ $or: [{ email: u.email }, { username: u.username }] });
    if (existing) {
      if (existing.email === u.email) {
        existingEmails.push(u.email);
      }
      if (existing.username === u.username) {
        existingUsernames.push(u.username);
      }
    }
  }

  if (existingEmails.length > 0 || existingUsernames.length > 0) {
    console.red('\nError: The following users already exist in the database:\n');
    if (existingEmails.length > 0) {
      console.red('  Emails: ' + existingEmails.join(', '));
    }
    if (existingUsernames.length > 0) {
      console.red('  Usernames: ' + existingUsernames.join(', '));
    }
    console.red('\nPlease remove duplicates from the CSV and try again.');
    silentExit(1);
  }

  // ---- Generate passwords ----
  for (const u of users) {
    u.password = generatePassword(16);
  }

  // ---- Display user table ----
  console.purple('\nThe following accounts will be created:\n');
  printUserTable(users);

  // ---- Save credentials to file ----
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const credentialsFile = path.join(outputDir, `bulk-register-credentials-${timestamp}.csv`);
  saveCredentials(users, credentialsFile);
  console.green(`\nCredentials saved to: ${credentialsFile}`);

  // ---- Ask for approval ----
  console.purple('\n==========================================');
  const approval = await askQuestion(
    'Do you want to CREATE all these accounts? (yes/no)\n' +
    'Type "yes" to proceed, anything else to abort:',
  );

  if (approval.toLowerCase() !== 'yes') {
    // Clean up the credentials file
    fs.unlinkSync(credentialsFile);
    console.orange('\nAborted! No accounts were created.');
    console.orange('Credentials file has been deleted.');
    silentExit(0);
  }

  // ---- Create all user accounts ----
  console.purple('\nCreating user accounts...\n');

  const created = [];
  const failed = [];

  for (const u of users) {
    try {
      const userData = {
        email: u.email,
        password: u.password,
        name: u.name,
        username: u.username,
        confirm_password: u.password,
        role: u.role,
      };

      const result = await registerUser(userData, { emailVerified: true, role: u.role });

      if (result.status === 200) {
        console.green(`  ✓ Created: ${u.email} (${u.name})`);
        created.push(u);
      } else {
        console.red(`  ✗ Failed:  ${u.email} - ${result.message}`);
        failed.push({ ...u, error: result.message });
      }
    } catch (error) {
      console.red(`  ✗ Error:   ${u.email} - ${error.message}`);
      failed.push({ ...u, error: error.message });
    }
  }

  console.log('');
  console.green(`Successfully created: ${created.length}/${users.length}`);
  if (failed.length > 0) {
    console.red(`Failed: ${failed.length}/${users.length}`);
    failed.forEach((f) => console.red(`  - ${f.email}: ${f.error}`));
  }

  // Update credentials file to only include successfully created users
  if (failed.length > 0 && created.length > 0) {
    saveCredentials(created, credentialsFile);
    console.orange(`\nCredentials file updated (only successfully created users).`);
  } else if (created.length === 0) {
    fs.unlinkSync(credentialsFile);
    console.red('\nNo users were created. Credentials file deleted.');
    silentExit(1);
  }

  // ---- Send welcome emails ----
  console.purple('\n==========================================');

  const emailConfigured = checkEmailConfig();
  if (!emailConfigured) {
    console.orange('\nEmail service is NOT configured. Skipping welcome emails.');
    console.orange('You can send welcome emails later using: npm run send-welcome-email');
    console.green(`\nDone! Credentials are saved in:\n  ${credentialsFile}`);
    silentExit(0);
  }

  const sendMails = await askQuestion(
    'Do you want to send WELCOME EMAILS to all created users? (yes/no)\n' +
    'Type "yes" to send, anything else to skip:',
  );

  if (sendMails.toLowerCase() !== 'yes') {
    console.orange('\nSkipped sending welcome emails.');
    console.orange('You can send them later using: npm run send-welcome-email <name> <email> <password>');
    console.green(`\nDone! Credentials are saved in:\n  ${credentialsFile}`);
    silentExit(0);
  }

  // Send emails
  const loginUrl = process.env.DOMAIN_CLIENT || 'https://ai.intra-ai.de';
  const registrationGuideUrl = process.env.REGISTRATION_GUIDE_URL || 'https://chat.intra-ai.de/tutorials/registration';

  console.purple('\nSending welcome emails...\n');

  let emailsSent = 0;
  let emailsFailed = 0;

  for (const u of created) {
    try {
      await sendEmail({
        email: u.email,
        subject: 'Willkommen bei Intra AI - Ihre Zugangsdaten',
        payload: {
          name: u.name,
          email: u.email,
          password: u.password,
          loginUrl: loginUrl,
          registrationGuideUrl: registrationGuideUrl,
          year: new Date().getFullYear(),
        },
        template: 'welcomeNewUser.handlebars',
      });
      console.green(`  ✓ Email sent: ${u.email}`);
      emailsSent++;
    } catch (error) {
      console.red(`  ✗ Email failed: ${u.email} - ${error.message}`);
      emailsFailed++;
    }
  }

  console.log('');
  console.green(`Emails sent: ${emailsSent}/${created.length}`);
  if (emailsFailed > 0) {
    console.red(`Emails failed: ${emailsFailed}/${created.length}`);
  }

  // ---- Done ----
  console.purple('\n==========================================');
  console.green('Bulk registration complete!');
  console.green(`Credentials saved in:\n  ${credentialsFile}`);
  console.purple('==========================================');
  silentExit(0);
})();

process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('There was an uncaught error:');
    console.error(err);
  }

  if (err.message.includes('fetch failed')) {
    return;
  } else {
    process.exit(1);
  }
});
