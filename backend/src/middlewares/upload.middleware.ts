/**
 * File Upload Middleware
 * Configures Multer for audio file uploads with validation.
 *
 * Responsibilities:
 * - Limit file size based on config
 * - Validate MIME type against allowed audio formats
 * - Store files temporarily in uploads directory
 * - Generate unique filenames to prevent collisions
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { AppError } from '../utils/AppError';

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

/**
 * Storage configuration: saves files to disk with unique names.
 * Using disk storage instead of memory for large audio files
 * to prevent memory issues under load.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

/**
 * File filter: validates MIME type before accepting the upload.
 * This is the first line of defense against invalid file types.
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const mimeAllowed = config.allowedAudioMimeTypes.includes(file.mimetype);
  const extAllowed = config.allowedAudioExtensions.includes(
    path.extname(file.originalname).toLowerCase(),
  );

  if (mimeAllowed || extAllowed) {
    cb(null, true);
  } else {
    cb(
      AppError.unsupportedMedia(
        `Unsupported audio format: ${file.mimetype}. ` +
        `Allowed: ${config.allowedAudioExtensions.join(', ')}`,
      ) as any,
    );
  }
};

/**
 * Configured Multer instance for single audio file upload.
 * Field name: 'audio' — frontend must use this field name.
 */
export const uploadAudio = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeBytes,
    files: 1,
  },
}).single('audio');
