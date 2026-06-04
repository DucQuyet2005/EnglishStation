/**
 * Dictation Routes
 * Endpoints for lesson management and dictation progress.
 *
 * Route structure:
 * GET    /api/transcriptions            - List user's lessons
 * PUT    /api/transcriptions/:id        - Rename a lesson
 * DELETE /api/transcriptions/:id        - Delete a lesson
 * GET    /api/dictation/progress/:tid   - Get progress for a lesson
 * POST   /api/dictation/progress        - Update progress
 */
import { Router } from 'express';
import { authenticate } from '../middlewares';
import * as dictationController from '../controllers/dictation.controller';

const router = Router();

// ---- Lesson Management (requires auth) ----
router.get('/transcriptions', authenticate, dictationController.getTranscriptions);
router.put('/transcriptions/:id', authenticate, dictationController.updateTranscription);
router.delete('/transcriptions/:id', authenticate, dictationController.deleteTranscription);

// ---- Dictation Progress (requires auth) ----
router.get('/dictation/progress/:transcriptionId', authenticate, dictationController.getDictationProgress);
router.post('/dictation/progress', authenticate, dictationController.updateDictationProgress);

export default router;
