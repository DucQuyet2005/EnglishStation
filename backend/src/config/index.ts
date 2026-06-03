/**
 * Application Configuration
 * Centralized config loaded from environment variables with sensible defaults.
 * All config access should go through this module.
 */
import dotenv from 'dotenv';
import path from 'path';

// Load .env file in development
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // Whisper Service
  whisperServiceUrl: process.env.WHISPER_SERVICE_URL || 'http://localhost:8000',

  // File Upload
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024,
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  allowedAudioMimeTypes: [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/x-m4a',
    'audio/aac',
  ],
  allowedAudioExtensions: [
    '.wav', '.mp3', '.ogg', '.webm',
    '.flac', '.m4a', '.aac', '.mp4',
  ],

  // CORS
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'dev',

  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/english_station',
} as const;

export type AppConfig = typeof config;
