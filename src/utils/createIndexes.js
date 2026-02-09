/**
 * Database Index Creation Script
 * Run this script to create recommended indexes for optimal query performance
 * 
 * Usage: node src/utils/createIndexes.js
 */

const mongoose = require('mongoose');
const { RECOMMENDED_INDEXES } = require('./queryOptimization');
const LoggerService = require('../services/logger');

// Import models
const User = require('../models/user');
const Product = require('../models/products');
const Order = require('../models/order');

const modelMap = {
    user: User,
    product: Product,
    order: Order,
};

/**
 * Create indexes for a specific model
 */
const createIndexesForModel = async (modelName, model, indexes) => {
    if (!model) {
        LoggerService.warn(`Model ${modelName} not found, skipping indexes`);
        return;
    }

    LoggerService.info(`Creating indexes for ${modelName}...`);

    for (const index of indexes) {
        try {
            await model.collection.createIndex(index);
            LoggerService.info(`✅ Created index: ${JSON.stringify(index)}`);
        } catch (error) {
            if (error.code === 85 || error.code === 86) {
                // Index already exists or index options changed
                LoggerService.warn(`Index already exists or needs update: ${JSON.stringify(index)}`);
            } else {
                LoggerService.error(`Failed to create index ${JSON.stringify(index)}:`, { error });
            }
        }
    }
};

/**
 * Create all recommended indexes
 */
const createAllIndexes = async () => {
    try {
        LoggerService.info('Starting index creation...');

        for (const [modelName, indexes] of Object.entries(RECOMMENDED_INDEXES)) {
            const model = modelMap[modelName];
            await createIndexesForModel(modelName, model, indexes);
        }

        LoggerService.info('✅ Index creation complete!');

        // List all indexes
        LoggerService.info('\n📊 Current indexes:');
        for (const [modelName, model] of Object.entries(modelMap)) {
            if (model) {
                const indexes = await model.collection.getIndexes();
                LoggerService.info(`${modelName}:`, { indexes });
            }
        }
    } catch (error) {
        LoggerService.error('Index creation failed:', { error });
    }
};

/**
 * Main execution
 */
const main = async () => {
    try {
        // Load environment
        require('dotenv').config();

        // Connect to database
        const connectDB = require('../config/dbConnact');
        await connectDB();

        // Create indexes
        await createAllIndexes();

        // Close connection
        await mongoose.connection.close();
        LoggerService.info('Database connection closed');
        process.exit(0);
    } catch (error) {
        LoggerService.error('Script failed:', { error });
        process.exit(1);
    }
};

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { createAllIndexes, createIndexesForModel };
