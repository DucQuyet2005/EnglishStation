/**
 * Validation Middleware
 * Validates uploaded audio files before processing.
 * Runs AFTER Multer has saved the file to disk.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { config } from '../config';
import path from 'path';

/**
 * Validates that an audio file was actually uploaded
 * and performs secondary validation on the file.
 */
export const validateAudioUpload = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // Check that a file was provided
  if (!req.file) {
    return next(AppError.badRequest('No audio file provided. Please upload an audio file.'));
  }

  // Double-check file extension (defense in depth)
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!config.allowedAudioExtensions.includes(ext)) {
    return next(
      AppError.unsupportedMedia(
        `File extension "${ext}" is not supported. Allowed: ${config.allowedAudioExtensions.join(', ')}`,
      ),
    );
  }

  // Double-check file size (defense in depth)
  if (req.file.size > config.maxFileSizeBytes) {
    return next(
      AppError.tooLarge(
        `File size ${(req.file.size / 1024 / 1024).toFixed(2)}MB exceeds ` +
        `maximum of ${config.maxFileSizeMB}MB`,
      ),
    );
  }

  // File is valid, proceed
  next();
};
