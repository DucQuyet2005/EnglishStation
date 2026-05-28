/**
 * Route Index
 * Central router that mounts all route modules.
 */
import { Router } from 'express';
import transcriptionRoutes from './transcription.routes';

const router = Router();

// Mount route modules
router.use('/', transcriptionRoutes);

export default router;
