import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

export const connectDB = async (retries = 5, delayMs = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(config.mongodbUri);
      logger.info('🍃 MongoDB connected successfully!');
      return;
    } catch (error) {
      logger.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed:`, error);
      if (attempt < retries) {
        logger.info(`⏳ Retrying MongoDB connection in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        logger.error('💥 All MongoDB connection attempts exhausted. Exiting.');
        process.exit(1);
      }
    }
  }
};
