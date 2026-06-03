/**
 * Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/google
 * GET  /api/auth/me
 */
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.get('/me', authenticate, authController.getMe);

export default router;
