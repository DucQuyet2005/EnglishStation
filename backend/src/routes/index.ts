import { Router } from 'express';
import transcriptionRoutes from './transcription.routes';
import authRoutes from './auth.routes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/', transcriptionRoutes);

export default router;

