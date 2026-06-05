/**
 * EnglishStation Backend Server
 *
 * Express application entry point running on Bun runtime.
 * Sets up middleware stack, routes, and error handling.
 *
 * Architecture:
 * Frontend (React) → Express API → Python Whisper Service
 *
 * Middleware stack (in order):
 * 1. Helmet       → Security headers
 * 2. CORS         → Cross-origin access control
 * 3. Morgan       → HTTP request logging
 * 4. Rate Limiter → Request throttling
 * 5. JSON Parser  → Body parsing
 * 6. Routes       → API endpoints
 * 7. 404 Handler  → Catch unmatched routes
 * 8. Error Handler → Global error formatting
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { connectDB } from './config/database';
import routes from './routes';
import { errorHandler } from './middlewares';
import { sendError } from './utils/responseHelper';
import { logger } from './utils/logger';

const app = express();

// ============================================
// Security Middleware
// ============================================

// Helmet: Sets various HTTP security headers
app.use(helmet());

// CORS: Allow frontend to communicate with backend
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // Cache preflight for 24 hours
}));

// ============================================
// Logging Middleware
// ============================================

// Morgan: HTTP request logging
app.use(morgan(config.logLevel));

// ============================================
// Rate Limiting
// ============================================

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please wait before trying again.',
    },
    timestamp: new Date().toISOString(),
  },
});

app.use('/api/', limiter);

// ============================================
// Body Parsing
// ============================================

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ============================================
// API Routes
// ============================================

app.use('/api', routes);

// ============================================
// 404 Handler — must be after all routes
// ============================================

app.use((_req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'The requested endpoint does not exist');
});

// ============================================
// Global Error Handler — must be last
// ============================================

app.use(errorHandler);

// ============================================
// Start Server
// ============================================

connectDB().then(() => {
  app.listen(config.port, () => {
    logger.info(`🚀 EnglishStation Backend running on port ${config.port}`);
    logger.info(`📡 Whisper Service URL: ${config.whisperServiceUrl}`);
    logger.info(`🌍 Allowed Origins: ${config.allowedOrigins.join(', ')}`);
    logger.info(`📁 Upload Directory: ${config.uploadDir}`);
    logger.info(`📏 Max File Size: ${config.maxFileSizeMB}MB`);
  });
});

export default app;
