const path = require('path');
const mongoose = require('mongoose');
const { checkEmailConfig } = require('@librechat/api');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { askQuestion, silentExit } = require('./helpers');
const { sendEmail } = require('~/server/utils');
const connect = require('./connect');

(async () => {
  await connect();

  console.purple('----------------------------------');
  console.purple('Send welcome email to a new user!');
  console.purple('----------------------------------');

  if (process.argv.length < 5) {
    console.orange('Usage: npm run send-welcome-email <name> <email> <password>');
    console.orange('Note: if you do not pass in the arguments, you will be prompted for them.');
    console.purple('----------------------------------');
  }

  // Check if email service is enabled
  if (!checkEmailConfig()) {
    console.red('Error: Email service is not enabled!');
    console.red('Please configure EMAIL_SERVICE or SMTP settings in your .env file.');
    silentExit(1);
  }

  let name = '';
  let email = '';
  let password = '';

  // Parse command line arguments
  if (process.argv.length >= 3) {
    name = process.argv[2];
  }
  if (process.argv.length >= 4) {
    email = process.argv[3];
  }
  if (process.argv.length >= 5) {
    password = process.argv[4];
  }

  // Prompt for missing values
  if (!name) {
    name = await askQuestion('Name der Person:');
  }
  if (!name) {
    console.red('Error: Name is required!');
    silentExit(1);
  }

  if (!email) {
    email = await askQuestion('E-Mail-Adresse:');
  }
  if (!email.includes('@')) {
    console.red('Error: Invalid email address!');
    silentExit(1);
  }

  if (!password) {
    password = await askQuestion('Initialpasswort:');
  }
  if (!password) {
    console.red('Error: Password is required!');
    silentExit(1);
  }

  // Optional: Check if user exists
  const userExists = await User.findOne({ email });
  if (!userExists) {
    console.orange(`Warning: No user with email "${email}" found in the database.`);
    const proceed = await askQuestion('Do you want to send the email anyway? (y/N):');
    if (proceed.toLowerCase() !== 'y') {
      console.orange('Email not sent.');
      silentExit(0);
    }
  }

  // Prepare the login URL
  const loginUrl = process.env.DOMAIN_CLIENT || 'https://ai.intra-ai.de';

  // Guide URLs - update these to your actual documentation URLs
  const registrationGuideUrl = process.env.REGISTRATION_GUIDE_URL || 'https://chat.intra-ai.de/tutorials/registration';

  try {
    await sendEmail({
      email: email,
      subject: 'Willkommen bei Intra AI - Ihre Zugangsdaten',
      payload: {
        name: name,
        email: email,
        password: password,
        loginUrl: loginUrl,
        registrationGuideUrl: registrationGuideUrl,
        year: new Date().getFullYear(),
      },
      template: 'welcomeNewUser.handlebars',
    });
  } catch (error) {
    console.error('Error sending email: ' + error.message);
    silentExit(1);
  }

  // Done!
  console.green('----------------------------------');
  console.green('Welcome email sent successfully!');
  console.green(`Recipient: ${name} <${email}>`);
  console.green('----------------------------------');
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
