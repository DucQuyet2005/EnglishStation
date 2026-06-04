import { Router } from 'express';
import transcriptionRoutes from './transcription.routes';
import authRoutes from './auth.routes';
import dictationRoutes from './dictation.routes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/', transcriptionRoutes);
router.use('/', dictationRoutes);

export default router;

