/**
 * Auth Controller
 * Handles register, login, Google OAuth, and profile fetch.
 */
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

import { User } from '../models/Schemas';
import { config } from '../config';
import { sendSuccess, sendError } from '../utils/responseHelper';
import { Logger } from '../utils/logger';
import { JwtPayload } from '../middlewares/auth.middleware';

const log = new Logger('AuthController');
const googleClient = new OAuth2Client(config.googleClientId);

/** Sign a JWT for a given user */
function signToken(userId: string, email: string, fullName?: string): string {
  const payload: JwtPayload = { userId, email, fullName };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

// ── POST /api/auth/register ─────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, fullName } = req.body;

  if (!email || !password) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    return;
  }

  if (password.length < 6) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Password must be at least 6 characters');
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    sendError(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, fullName });

  const token = signToken(user._id.toString(), user.email, user.fullName);

  log.info(`New user registered: ${user.email}`);
  sendSuccess(res, {
    token,
    user: { id: user._id, email: user.email, fullName: user.fullName },
  }, 'Account created successfully', 201);
};

// ── POST /api/auth/login ────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    return;
  }

  const token = signToken(user._id.toString(), user.email, user.fullName);

  log.info(`User logged in: ${user.email}`);
  sendSuccess(res, {
    token,
    user: { id: user._id, email: user.email, fullName: user.fullName },
  }, 'Login successful');
};

// ── POST /api/auth/google ───────────────────────────────────────────────────
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body;

  if (!idToken) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Google ID token is required');
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      sendError(res, 401, 'GOOGLE_AUTH_FAILED', 'Failed to verify Google token');
      return;
    }

    const { email, name, sub: googleId } = payload;

    // Upsert user: find by email or create new
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // New user via Google — no password needed
      user = await User.create({
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(googleId + config.jwtSecret, 12), // deterministic placeholder
        fullName: name,
      });
      log.info(`New user registered via Google: ${user.email}`);
    } else {
      log.info(`Existing user logged in via Google: ${user.email}`);
    }

    const token = signToken(user._id.toString(), user.email, user.fullName);

    sendSuccess(res, {
      token,
      user: { id: user._id, email: user.email, fullName: user.fullName },
    }, user.createdAt === user.updatedAt ? 'Account created via Google' : 'Login successful');
  } catch (err) {
    log.error('Google auth error', err);
    sendError(res, 401, 'GOOGLE_AUTH_FAILED', 'Invalid Google token');
  }
};

// ── GET /api/auth/me ────────────────────────────────────────────────────────
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.user!.userId).select('-passwordHash');
  if (!user) {
    sendError(res, 404, 'NOT_FOUND', 'User not found');
    return;
  }
  sendSuccess(res, { user });
};
