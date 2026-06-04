/**
 * Dictation Controller
 * Handles lesson management (list, rename, delete transcriptions)
 * and dictation progress tracking.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { AppError } from '../utils/AppError';
import { Transcription, DictationProgress } from '../models/Schemas';
import { Logger } from '../utils/logger';
import mongoose from 'mongoose';

const log = new Logger('DictationController');

/**
 * GET /api/transcriptions
 * Returns all transcription lessons for the current user,
 * joined with their dictation progress.
 */
export const getTranscriptions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    const lessons = await Transcription.aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: 'dictationprogresses',
          localField: '_id',
          foreignField: 'transcriptionId',
          pipeline: [
            { $match: { userId } }
          ],
          as: 'progress'
        }
      },
      {
        $project: {
          title: 1,
          sourceUrl: 1,
          duration: 1,
          language: 1,
          totalSegments: { $size: { $ifNull: ['$segments', []] } },
          createdAt: 1,
          updatedAt: 1,
          currentSegment: { $ifNull: [{ $arrayElemAt: ['$progress.currentSegmentIndex', 0] }, 0] },
          completed: { $ifNull: [{ $arrayElemAt: ['$progress.completed', 0] }, false] }
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);

    log.info(`Fetched ${lessons.length} lessons for user ${req.user!.userId}`);
    sendSuccess(res, lessons, 'Lessons retrieved');
  },
);

/**
 * PUT /api/transcriptions/:id
 * Rename a transcription lesson title.
 * Validates ownership before updating.
 */
export const updateTranscription = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw AppError.badRequest('Title is required');
    }

    const transcription = await Transcription.findById(id);
    if (!transcription) {
      throw AppError.notFound('Lesson not found');
    }

    if (transcription.userId.toString() !== req.user!.userId) {
      throw AppError.forbidden('You do not own this lesson');
    }

    transcription.title = title.trim();
    await transcription.save();

    log.info(`Lesson ${id} renamed to "${title.trim()}" by user ${req.user!.userId}`);
    sendSuccess(res, { _id: transcription._id, title: transcription.title }, 'Lesson renamed');
  },
);

/**
 * DELETE /api/transcriptions/:id
 * Delete a transcription and its associated DictationProgress.
 */
export const deleteTranscription = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const transcription = await Transcription.findById(id);
    if (!transcription) {
      throw AppError.notFound('Lesson not found');
    }

    if (transcription.userId.toString() !== req.user!.userId) {
      throw AppError.forbidden('You do not own this lesson');
    }

    // Delete transcription and its progress in parallel
    await Promise.all([
      Transcription.findByIdAndDelete(id),
      DictationProgress.deleteMany({ transcriptionId: id }),
    ]);

    log.info(`Lesson ${id} deleted by user ${req.user!.userId}`);
    sendSuccess(res, null, 'Lesson deleted');
  },
);

/**
 * GET /api/dictation/progress/:transcriptionId
 * Get the current user's dictation progress for a specific lesson.
 * Also returns the transcription segments for the workspace.
 */
export const getDictationProgress = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const transcriptionId = req.params.transcriptionId as string;
    const userId = req.user!.userId as string;

    const transcription = await Transcription.findById(transcriptionId);
    if (!transcription) {
      throw AppError.notFound('Lesson not found');
    }

    if (transcription.userId.toString() !== userId) {
      throw AppError.forbidden('You do not own this lesson');
    }

    // Get or create progress
    let progress = await DictationProgress.findOne({
      userId: new mongoose.Types.ObjectId(userId as string),
      transcriptionId: new mongoose.Types.ObjectId(transcriptionId as string),
    });

    if (!progress) {
      progress = await DictationProgress.create({
        userId: new mongoose.Types.ObjectId(userId as string),
        transcriptionId: new mongoose.Types.ObjectId(transcriptionId as string),
        currentSegmentIndex: 0,
        completed: false,
        hintsUsedCount: 0,
        incorrectAttempts: 0,
        lastActiveAt: new Date(),
      });
    }

    sendSuccess(res, {
      transcription: {
        _id: transcription._id,
        title: transcription.title,
        sourceUrl: transcription.sourceUrl,
        duration: transcription.duration,
        language: transcription.language,
        segments: transcription.segments,
      },
      progress: {
        currentSegmentIndex: progress.currentSegmentIndex,
        completed: progress.completed,
        hintsUsedCount: progress.hintsUsedCount,
        incorrectAttempts: progress.incorrectAttempts,
        lastActiveAt: progress.lastActiveAt,
      },
    }, 'Progress retrieved');
  },
);

/**
 * POST /api/dictation/progress
 * Update dictation progress (advance segment, record hints/errors).
 */
export const updateDictationProgress = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { transcriptionId, currentSegmentIndex, hintsUsed, incorrectAttempt } = req.body;

    if (!transcriptionId) {
      throw AppError.badRequest('transcriptionId is required');
    }

    const userId = req.user!.userId as string;

    const transcription = await Transcription.findById(transcriptionId);
    if (!transcription) {
      throw AppError.notFound('Lesson not found');
    }

    if (transcription.userId.toString() !== userId) {
      throw AppError.forbidden('You do not own this lesson');
    }

    const totalSegments = transcription.segments?.length || 0;
    const segIdx = typeof currentSegmentIndex === 'number' ? currentSegmentIndex : undefined;
    const isCompleted = segIdx !== undefined && segIdx >= totalSegments;

    const updateOps: Record<string, any> = {
      lastActiveAt: new Date(),
    };

    if (segIdx !== undefined) {
      updateOps.currentSegmentIndex = Math.min(segIdx, totalSegments);
      updateOps.completed = isCompleted;
    }

    const incOps: Record<string, number> = {};
    if (hintsUsed) incOps.hintsUsedCount = 1;
    if (incorrectAttempt) incOps.incorrectAttempts = 1;

    const progress = await DictationProgress.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        transcriptionId: new mongoose.Types.ObjectId(transcriptionId),
      },
      {
        $set: updateOps,
        ...(Object.keys(incOps).length > 0 ? { $inc: incOps } : {}),
      },
      { upsert: true, new: true },
    );

    sendSuccess(res, {
      currentSegmentIndex: progress.currentSegmentIndex,
      completed: progress.completed,
      hintsUsedCount: progress.hintsUsedCount,
      incorrectAttempts: progress.incorrectAttempts,
    }, 'Progress updated');
  },
);
