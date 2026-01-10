#!/usr/bin/env node
/**
 * DSGVO Article 20 - Data Portability Export Script
 * Datenportabilität gemäß Art. 20 DSGVO
 * 
 * This script exports ALL personal data stored for a user in a structured,
 * commonly used, and machine-readable format (JSON).
 * 
 * Usage:
 *   node config/export-user-data.js <user-email>
 *   node config/export-user-data.js <user-email> --send-to=recipient@example.com
 *   node config/export-user-data.js <user-email> --format=json|csv
 *   node config/export-user-data.js <user-email> --output=/path/to/output
 * 
 * Options:
 *   --send-to=<email>    Send the export directly via email to this address
 *   --format=json|csv    Export format (default: json)
 *   --output=<path>      Custom output directory
 * 
 * The export includes:
 *   - User profile data
 *   - Conversations and messages
 *   - Files metadata
 *   - Presets and preferences
 *   - Agents created by user
 *   - Prompts and prompt groups
 *   - Transaction/balance history
 *   - Tags and organization data
 *   - Memory entries
 *   - Shared links
 *   - Tool call history
 *   - Audit logs
 *   - Session data
 *   - API keys (names only, not values)
 *   - Actions (custom integrations)
 *   - Assistants configuration
 *   - Plugin authentication (metadata only)
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const axios = require('axios');
const FormData = require('form-data');
const {
  User,
  Agent,
  Assistant,
  Balance,
  Transaction,
  ConversationTag,
  Conversation,
  Message,
  File,
  Key,
  MemoryEntry,
  PluginAuth,
  Prompt,
  PromptGroup,
  Preset,
  Session,
  SharedLink,
  ToolCall,
  Token,
  Action,
  AclEntry,
  Group,
  AuditLog,
} = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { askQuestion, silentExit } = require('./helpers');
const connect = require('./connect');

/**
 * Sanitize sensitive data from user object
 * Removes password hashes, tokens, secrets while keeping relevant personal data
 */
function sanitizeUserData(user) {
  const sanitized = { ...user };
  
  // Remove sensitive authentication data
  delete sanitized.password;
  delete sanitized.totpSecret;
  delete sanitized.backupCodes;
  delete sanitized.refreshToken;
  
  // Keep but note these are IDs only
  if (sanitized.__v !== undefined) delete sanitized.__v;
  
  return sanitized;
}

/**
 * Sanitize key data - only export names, not actual API key values
 */
function sanitizeKeyData(key) {
  return {
    _id: key._id,
    name: key.name,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
    // Note: value is intentionally excluded for security
    _note: 'API key value excluded for security reasons'
  };
}

/**
 * Sanitize plugin auth data - only export metadata
 */
function sanitizePluginAuth(auth) {
  return {
    _id: auth._id,
    authField: auth.authField,
    pluginKey: auth.pluginKey,
    createdAt: auth.createdAt,
    updatedAt: auth.updatedAt,
    // Note: value is intentionally excluded for security
    _note: 'Authentication value excluded for security reasons'
  };
}

/**
 * Sanitize action data - exclude sensitive OAuth credentials
 */
function sanitizeActionData(action) {
  const sanitized = { ...action };
  if (sanitized.metadata) {
    sanitized.metadata = { ...sanitized.metadata };
    delete sanitized.metadata.api_key;
    delete sanitized.metadata.oauth_client_secret;
    sanitized.metadata._note = 'Sensitive credentials excluded for security';
  }
  return sanitized;
}

/**
 * Convert data to CSV format (simplified)
 */
function toCSV(data, name) {
  if (!Array.isArray(data) || data.length === 0) {
    return `# ${name} - No data\n`;
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      let val = row[header];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') val = JSON.stringify(val);
      // Escape quotes and wrap in quotes if contains comma
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        val = `"${val}"`;
      }
      return val;
    });
    csvRows.push(values.join(','));
  }
  
  return `# ${name}\n${csvRows.join('\n')}\n\n`;
}

/**
 * Check if email sending is configured
 */
function isEmailConfigured() {
  const hasMailgun = process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN;
  const hasSMTP = (process.env.EMAIL_SERVICE || process.env.EMAIL_HOST) && 
                  process.env.EMAIL_USERNAME && 
                  process.env.EMAIL_PASSWORD && 
                  process.env.EMAIL_FROM;
  return hasMailgun || hasSMTP;
}

/**
 * Send export file via email
 */
async function sendExportEmail({ recipientEmail, userName, filePath, fileName, summary }) {
  const fromName = process.env.EMAIL_FROM_NAME || process.env.APP_TITLE || 'LibreChat';
  const fromEmail = process.env.EMAIL_FROM;
  
  if (!fromEmail) {
    throw new Error('EMAIL_FROM environment variable is not configured');
  }

  const fromAddress = `"${fromName}" <${fromEmail}>`;
  const toAddress = recipientEmail;
  
  const subject = `DSGVO Data Export - Your Personal Data`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
    .summary { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .summary-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
    h1 { margin: 0; font-size: 24px; }
    h2 { color: #4F46E5; margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 DSGVO Data Export</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Article 20 GDPR - Data Portability</p>
    </div>
    <div class="content">
      <h2>Dear ${userName || 'User'},</h2>
      <p>As requested, please find attached your complete personal data export in accordance with <strong>Article 20 GDPR (Datenportabilität)</strong>.</p>
      
      <div class="summary">
        <h3 style="margin-top: 0;">📊 Export Summary</h3>
        <div class="summary-item"><span>Conversations:</span> <strong>${summary.totalConversations}</strong></div>
        <div class="summary-item"><span>Messages:</span> <strong>${summary.totalMessages}</strong></div>
        <div class="summary-item"><span>Files:</span> <strong>${summary.totalFiles}</strong></div>
        <div class="summary-item"><span>Presets:</span> <strong>${summary.totalPresets}</strong></div>
        <div class="summary-item"><span>Agents:</span> <strong>${summary.totalAgents}</strong></div>
        <div class="summary-item"><span>Prompts:</span> <strong>${summary.totalPrompts}</strong></div>
        <div class="summary-item"><span>Transactions:</span> <strong>${summary.totalTransactions}</strong></div>
        <div class="summary-item"><span>Memory Entries:</span> <strong>${summary.totalMemoryEntries}</strong></div>
        <div class="summary-item"><span>Audit Logs:</span> <strong>${summary.totalAuditLogs}</strong></div>
      </div>
      
      <p><strong>File format:</strong> The attached file is in JSON format, which is a structured, machine-readable format that can be:</p>
      <ul>
        <li>Opened with any text editor</li>
        <li>Imported into other services</li>
        <li>Processed programmatically</li>
      </ul>
      
      <p style="color: #dc2626;"><strong>⚠️ Security Note:</strong> This file contains your personal data. Please store it securely and delete it when no longer needed.</p>
    </div>
    <div class="footer">
      <p>This email was generated automatically in response to a GDPR Article 20 data portability request.</p>
      <p>Export date: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
  `;

  // Read the file to attach
  const fileContent = fs.readFileSync(filePath);
  
  // Check if Mailgun is configured
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    console.gray('Sending email via Mailgun...');
    
    const mailgunApiKey = process.env.MAILGUN_API_KEY;
    const mailgunDomain = process.env.MAILGUN_DOMAIN;
    const mailgunHost = process.env.MAILGUN_HOST || 'https://api.mailgun.net';
    
    const formData = new FormData();
    formData.append('from', fromAddress);
    formData.append('to', toAddress);
    formData.append('subject', subject);
    formData.append('html', html);
    formData.append('o:tracking-clicks', 'no');
    formData.append('attachment', fileContent, { filename: fileName });
    
    const response = await axios.post(
      `${mailgunHost}/v3/${mailgunDomain}/messages`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`,
        },
      }
    );
    
    return response.data;
  }
  
  // Default to SMTP
  console.gray('Sending email via SMTP...');
  
  const isEnabled = (val) => val === 'true' || val === true;
  
  const transporterOptions = {
    secure: process.env.EMAIL_ENCRYPTION === 'tls',
    requireTls: process.env.EMAIL_ENCRYPTION === 'starttls',
    tls: {
      rejectUnauthorized: !isEnabled(process.env.EMAIL_ALLOW_SELFSIGNED),
    },
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  };

  if (process.env.EMAIL_ENCRYPTION_HOSTNAME) {
    transporterOptions.tls.servername = process.env.EMAIL_ENCRYPTION_HOSTNAME;
  }

  if (process.env.EMAIL_SERVICE) {
    transporterOptions.service = process.env.EMAIL_SERVICE;
  } else {
    transporterOptions.host = process.env.EMAIL_HOST;
    transporterOptions.port = process.env.EMAIL_PORT ?? 25;
  }

  const transporter = nodemailer.createTransport(transporterOptions);
  
  const mailOptions = {
    from: fromAddress,
    to: toAddress,
    subject: subject,
    html: html,
    attachments: [
      {
        filename: fileName,
        content: fileContent,
      }
    ]
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * Main export function
 */
async function exportUserData(email, options = {}) {
  const { format = 'json', outputDir = null } = options;
  
  // Find user
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +totpSecret +backupCodes').lean();
  if (!user) {
    throw new Error(`No user found with email "${email}"`);
  }

  const userId = user._id.toString();
  const exportTimestamp = new Date().toISOString();
  
  console.cyan(`\nExporting data for user: ${email}`);
  console.cyan(`User ID: ${userId}`);
  console.cyan('─'.repeat(50));

  // Collect all data
  const exportData = {
    _metadata: {
      exportDate: exportTimestamp,
      exportType: 'DSGVO Article 20 - Data Portability',
      format: format,
      userEmail: email,
      userId: userId,
      version: '1.0',
      description: 'Complete export of all personal data stored for this user',
      legalBasis: 'Article 20 GDPR - Right to data portability'
    },
    
    // 1. User Profile (core personal data)
    userProfile: null,
    
    // 2. Conversations & Messages (user activity)
    conversations: [],
    messages: [],
    
    // 3. Files (user uploads)
    files: [],
    
    // 4. Presets (user preferences)
    presets: [],
    
    // 5. Agents (user-created AI agents)
    agents: [],
    
    // 6. Assistants configuration
    assistants: [],
    
    // 7. Prompts & Prompt Groups (user-created prompts)
    prompts: [],
    promptGroups: [],
    
    // 8. Tags (conversation organization)
    conversationTags: [],
    
    // 9. Balance & Transactions (usage history)
    balance: null,
    transactions: [],
    
    // 10. Memory Entries (personalization)
    memoryEntries: [],
    
    // 11. Shared Links (shared conversations)
    sharedLinks: [],
    
    // 12. Tool Calls (AI tool usage history)
    toolCalls: [],
    
    // 13. Actions (custom integrations)
    actions: [],
    
    // 14. API Keys (metadata only)
    apiKeys: [],
    
    // 15. Plugin Authentications (metadata only)
    pluginAuth: [],
    
    // 16. Sessions (login history)
    sessions: [],
    
    // 17. Tokens (password reset, verification tokens)
    tokens: [],
    
    // 18. Audit Logs (account activity)
    auditLogs: [],
    
    // 19. ACL Entries (permissions granted by/to user)
    aclEntries: [],
    
    // 20. Group Memberships
    groupMemberships: []
  };

  // Fetch all data in parallel for efficiency
  console.gray('Fetching user data...');
  
  const [
    conversations,
    messages,
    files,
    presets,
    agents,
    assistants,
    prompts,
    promptGroups,
    conversationTags,
    balance,
    transactions,
    memoryEntries,
    sharedLinks,
    toolCalls,
    actions,
    keys,
    pluginAuths,
    sessions,
    tokens,
    auditLogs,
    aclEntriesGrantedBy,
    aclEntriesForUser,
    groups
  ] = await Promise.all([
    Conversation.find({ user: userId }).lean(),
    Message.find({ user: userId }).lean(),
    File.find({ user: userId }).select('-text').lean(), // Exclude large text field
    Preset.find({ user: userId }).lean(),
    Agent.find({ author: userId }).lean(),
    Assistant.find({ user: userId }).lean(),
    Prompt.find({ author: userId }).lean(),
    PromptGroup.find({ author: userId }).lean(),
    ConversationTag.find({ user: userId }).lean(),
    Balance.findOne({ user: userId }).lean(),
    Transaction.find({ user: userId }).lean(),
    MemoryEntry.find({ userId: userId }).lean(),
    SharedLink.find({ user: userId }).lean(),
    ToolCall.find({ user: userId }).lean(),
    Action.find({ user: userId }).lean(),
    Key.find({ userId: userId }).lean(),
    PluginAuth.find({ userId: userId }).lean(),
    Session.find({ user: userId }).lean(),
    Token.find({ userId: userId }).lean(),
    AuditLog.find({ userId: userId }).lean(),
    AclEntry.find({ grantedBy: userId }).lean(),
    AclEntry.find({ principalId: userId }).lean(),
    Group.find({ memberIds: userId }).lean()
  ]);

  // Populate export data with sanitization
  exportData.userProfile = sanitizeUserData(user);
  exportData.conversations = conversations;
  exportData.messages = messages;
  exportData.files = files;
  exportData.presets = presets;
  exportData.agents = agents;
  exportData.assistants = assistants;
  exportData.prompts = prompts;
  exportData.promptGroups = promptGroups;
  exportData.conversationTags = conversationTags;
  exportData.balance = balance;
  exportData.transactions = transactions;
  exportData.memoryEntries = memoryEntries;
  exportData.sharedLinks = sharedLinks;
  exportData.toolCalls = toolCalls;
  exportData.actions = actions.map(sanitizeActionData);
  exportData.apiKeys = keys.map(sanitizeKeyData);
  exportData.pluginAuth = pluginAuths.map(sanitizePluginAuth);
  exportData.sessions = sessions;
  exportData.tokens = tokens.map(t => ({
    ...t,
    token: '[REDACTED]',
    _note: 'Token value redacted for security'
  }));
  exportData.auditLogs = auditLogs;
  exportData.aclEntries = [...aclEntriesGrantedBy, ...aclEntriesForUser];
  exportData.groupMemberships = groups;

  // Generate summary statistics
  const summary = {
    totalConversations: conversations.length,
    totalMessages: messages.length,
    totalFiles: files.length,
    totalPresets: presets.length,
    totalAgents: agents.length,
    totalAssistants: assistants.length,
    totalPrompts: prompts.length,
    totalPromptGroups: promptGroups.length,
    totalTags: conversationTags.length,
    totalTransactions: transactions.length,
    totalMemoryEntries: memoryEntries.length,
    totalSharedLinks: sharedLinks.length,
    totalToolCalls: toolCalls.length,
    totalActions: actions.length,
    totalApiKeys: keys.length,
    totalPluginAuths: pluginAuths.length,
    totalSessions: sessions.length,
    totalAuditLogs: auditLogs.length,
    totalAclEntries: exportData.aclEntries.length,
    totalGroupMemberships: groups.length,
    hasBalance: !!balance,
    tokenCredits: balance?.tokenCredits || 0
  };

  exportData._metadata.summary = summary;

  // Print summary
  console.cyan('\n📊 Export Summary:');
  console.cyan('─'.repeat(50));
  console.white(`  User Profile:        ✓`);
  console.white(`  Conversations:       ${summary.totalConversations}`);
  console.white(`  Messages:            ${summary.totalMessages}`);
  console.white(`  Files:               ${summary.totalFiles}`);
  console.white(`  Presets:             ${summary.totalPresets}`);
  console.white(`  Agents:              ${summary.totalAgents}`);
  console.white(`  Assistants:          ${summary.totalAssistants}`);
  console.white(`  Prompts:             ${summary.totalPrompts}`);
  console.white(`  Prompt Groups:       ${summary.totalPromptGroups}`);
  console.white(`  Tags:                ${summary.totalTags}`);
  console.white(`  Balance:             ${summary.hasBalance ? `${summary.tokenCredits} credits` : 'None'}`);
  console.white(`  Transactions:        ${summary.totalTransactions}`);
  console.white(`  Memory Entries:      ${summary.totalMemoryEntries}`);
  console.white(`  Shared Links:        ${summary.totalSharedLinks}`);
  console.white(`  Tool Calls:          ${summary.totalToolCalls}`);
  console.white(`  Actions:             ${summary.totalActions}`);
  console.white(`  API Keys:            ${summary.totalApiKeys}`);
  console.white(`  Plugin Auth:         ${summary.totalPluginAuths}`);
  console.white(`  Sessions:            ${summary.totalSessions}`);
  console.white(`  Audit Logs:          ${summary.totalAuditLogs}`);
  console.white(`  ACL Entries:         ${summary.totalAclEntries}`);
  console.white(`  Group Memberships:   ${summary.totalGroupMemberships}`);
  console.cyan('─'.repeat(50));

  // Determine output filename
  const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const baseFilename = `dsgvo_export_${sanitizedEmail}_${dateStr}`;
  
  let outputPath;
  if (outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    outputPath = path.join(outputDir, `${baseFilename}.${format}`);
  } else {
    // Default to exports directory in project root
    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    outputPath = path.join(exportsDir, `${baseFilename}.${format}`);
  }

  // Write output file
  if (format === 'json') {
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
  } else if (format === 'csv') {
    // For CSV, create a zip-like structure with multiple files
    // Since we're doing simple export, we'll concatenate with headers
    let csvContent = '';
    csvContent += `# DSGVO Article 20 Data Export\n`;
    csvContent += `# User: ${email}\n`;
    csvContent += `# Export Date: ${exportTimestamp}\n`;
    csvContent += `# Format: CSV (Comma Separated Values)\n\n`;
    
    // User profile as single row
    csvContent += toCSV([exportData.userProfile], 'User Profile');
    csvContent += toCSV(exportData.conversations, 'Conversations');
    csvContent += toCSV(exportData.messages, 'Messages');
    csvContent += toCSV(exportData.files, 'Files');
    csvContent += toCSV(exportData.presets, 'Presets');
    csvContent += toCSV(exportData.agents, 'Agents');
    csvContent += toCSV(exportData.assistants, 'Assistants');
    csvContent += toCSV(exportData.prompts, 'Prompts');
    csvContent += toCSV(exportData.promptGroups, 'Prompt Groups');
    csvContent += toCSV(exportData.conversationTags, 'Conversation Tags');
    if (exportData.balance) {
      csvContent += toCSV([exportData.balance], 'Balance');
    }
    csvContent += toCSV(exportData.transactions, 'Transactions');
    csvContent += toCSV(exportData.memoryEntries, 'Memory Entries');
    csvContent += toCSV(exportData.sharedLinks, 'Shared Links');
    csvContent += toCSV(exportData.toolCalls, 'Tool Calls');
    csvContent += toCSV(exportData.actions, 'Actions');
    csvContent += toCSV(exportData.apiKeys, 'API Keys');
    csvContent += toCSV(exportData.pluginAuth, 'Plugin Auth');
    csvContent += toCSV(exportData.sessions, 'Sessions');
    csvContent += toCSV(exportData.auditLogs, 'Audit Logs');
    csvContent += toCSV(exportData.aclEntries, 'ACL Entries');
    csvContent += toCSV(exportData.groupMemberships, 'Group Memberships');
    
    fs.writeFileSync(outputPath, csvContent, 'utf8');
  }

  const stats = fs.statSync(outputPath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.green(`\n✅ Export completed successfully!`);
  console.green(`📁 Output file: ${outputPath}`);
  console.green(`📦 File size: ${fileSizeMB} MB`);
  
  return {
    success: true,
    outputPath,
    fileName: path.basename(outputPath),
    summary,
    fileSize: stats.size,
    userName: user.name
  };
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    email: null,
    format: 'json',
    output: null,
    sendTo: null
  };

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--send-to=')) {
      options.sendTo = arg.split('=')[1];
    } else if (!arg.startsWith('-') && !options.email) {
      options.email = arg;
    }
  }

  return options;
}

/**
 * Graceful exit
 */
async function gracefulExit(code = 0) {
  try {
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error disconnecting from MongoDB:', err);
  }
  silentExit(code);
}

/**
 * Main execution
 */
(async () => {
  await connect();

  console.purple('═'.repeat(60));
  console.purple('  DSGVO Article 20 - Data Portability Export');
  console.purple('  Datenportabilität gemäß Art. 20 DSGVO');
  console.purple('═'.repeat(60));
  console.white('\nThis script exports ALL personal data stored for a user');
  console.white('in a structured, machine-readable format (JSON/CSV).\n');

  // Parse arguments
  const options = parseArgs();

  // Get email if not provided
  let email = options.email;
  if (!email) {
    console.orange('Usage: node config/export-user-data.js <user-email> [options]');
    console.orange('');
    console.orange('Options:');
    console.orange('  --send-to=<email>    Send export directly via email');
    console.orange('  --format=json|csv    Export format (default: json)');
    console.orange('  --output=<path>      Custom output directory');
    console.orange('');
    email = await askQuestion('Enter user email to export:');
  }

  if (!email || !email.includes('@')) {
    console.red('Error: Invalid email address!');
    return gracefulExit(1);
  }

  // Get send-to email if not provided but user wants to send
  let sendToEmail = options.sendTo;
  if (!sendToEmail) {
    const wantToSend = await askQuestion('\nSend export via email? (y/N)');
    if (wantToSend.toLowerCase() === 'y') {
      if (!isEmailConfigured()) {
        console.red('Error: Email is not configured in environment variables!');
        console.orange('Required: EMAIL_FROM, EMAIL_HOST/EMAIL_SERVICE, EMAIL_USERNAME, EMAIL_PASSWORD');
        console.orange('Or: MAILGUN_API_KEY, MAILGUN_DOMAIN');
        return gracefulExit(1);
      }
      sendToEmail = await askQuestion('Enter recipient email address:');
      if (!sendToEmail || !sendToEmail.includes('@')) {
        console.red('Error: Invalid recipient email address!');
        return gracefulExit(1);
      }
    }
  }

  // Validate email config if sending
  if (sendToEmail && !isEmailConfigured()) {
    console.red('Error: Email is not configured in environment variables!');
    console.orange('Required: EMAIL_FROM, EMAIL_HOST/EMAIL_SERVICE, EMAIL_USERNAME, EMAIL_PASSWORD');
    console.orange('Or: MAILGUN_API_KEY, MAILGUN_DOMAIN');
    return gracefulExit(1);
  }

  // Confirm export
  let confirmMsg = `\nExport all data for ${email}?`;
  if (sendToEmail) {
    confirmMsg += ` (will be sent to ${sendToEmail})`;
  }
  confirmMsg += ' (y/N)';
  
  const confirm = await askQuestion(confirmMsg);
  if (confirm.toLowerCase() !== 'y') {
    console.yellow('Export cancelled.');
    return gracefulExit(0);
  }

  // Perform export
  try {
    const result = await exportUserData(email.trim().toLowerCase(), {
      format: options.format,
      outputDir: options.output
    });

    // Send email if requested
    if (sendToEmail) {
      console.cyan('\n📧 Sending export via email...');
      try {
        await sendExportEmail({
          recipientEmail: sendToEmail,
          userName: result.userName,
          filePath: result.outputPath,
          fileName: result.fileName,
          summary: result.summary
        });
        console.green(`✅ Email sent successfully to ${sendToEmail}`);
      } catch (emailError) {
        console.red(`\n❌ Failed to send email: ${emailError.message}`);
        console.orange(`The export file is still available at: ${result.outputPath}`);
        if (process.env.DEBUG) {
          console.error(emailError);
        }
      }
    }

    return gracefulExit(0);
  } catch (error) {
    console.red(`\n❌ Export failed: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    return gracefulExit(1);
  }
})().catch(async (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('There was an uncaught error:');
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  }
});
