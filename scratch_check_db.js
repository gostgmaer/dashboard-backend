const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./src/config/dbConnact');
const Setting = require('./src/models/Setting');

const run = async () => {
  try {
    console.log('Connecting to database via helper...');
    await connectDB();
    console.log('Connected!');
    
    // Fetch all settings for the active tenant
    const siteKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
    const settings = await Setting.find({ siteKey }).lean();
    console.log(`Settings Documents count for ${siteKey}:`, settings.length);
    if (settings.length > 0) {
      console.log('Sample settings documents (first 2):');
      console.log(JSON.stringify(settings.slice(0, 2), null, 2));
    }
    
    // Test inflation
    console.log('Calling Setting.getSettings()...');
    const inflated = await Setting.getSettings();
    if (inflated) {
      console.log('Inflated settings successfully fetched! Keys:', Object.keys(inflated));
    } else {
      console.log('No inflated settings found (not seeded yet).');
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error in script:', err);
  }
};

run();
