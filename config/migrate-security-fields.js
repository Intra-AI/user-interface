const path = require('path');
const mongoose = require('mongoose');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { askQuestion, silentExit } = require('./helpers');
const connect = require('./connect');

(async () => {
  await connect();

  console.purple('------------------------------------');
  console.purple('Migrating User Security Fields');
  console.purple('------------------------------------');

  console.yellow('This will add new security fields to all existing users.');
  console.yellow('Existing users will be marked as having completed initial requirements.');
  console.yellow('New users will need to complete these steps on first login.');
  console.yellow('');
  
  const confirm = await askQuestion('Are you sure you want to proceed? (y/n): ');

  if (confirm.toLowerCase() !== 'y') {
    console.yellow('Operation cancelled.');
    silentExit(0);
  }

  try {
    // Add new fields to all existing users
    // Existing users are marked as having completed these requirements
    const result = await User.updateMany(
      {},
      { 
        $set: { 
          initialPasswordReset: true,
          initialTwoFactorSetup: true,
        } 
      }
    );
    
    console.green(`✓ Updated ${result.modifiedCount} existing user(s) with new security fields.`);
    console.green('✓ Existing users are marked as having completed security requirements.');
    console.cyan('ℹ New users created after this migration will need to complete:');
    console.cyan('  - Initial password reset (if REQUIRE_INITIAL_PASSWORD_RESET=true)');
    console.cyan('  - Initial 2FA setup (if REQUIRE_INITIAL_2FA_SETUP=true)');
  } catch (error) {
    console.red('Error migrating security fields:', error);
    silentExit(1);
  }

  silentExit(0);
})();
