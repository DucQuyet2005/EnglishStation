import { Schema, model } from 'mongoose';
import { IUser, ITranscription, IVocabulary, IDictationProgress } from '../types/database';

// 1. User Schema
const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String },
}, { timestamps: true });

// 2. Transcription Schema
const TranscriptionSchema = new Schema<ITranscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  originalText: { type: String, required: true },
  translatedText: { type: String },
  sourceUrl: { type: String },
  duration: { type: Number, required: true },
  language: { type: String, required: true },
  segments: [{
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    text: { type: String, required: true },
    confidence: { type: Number }
  }]
}, { timestamps: true });

// 3. DictationProgress Schema
const DictationProgressSchema = new Schema<IDictationProgress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  transcriptionId: { type: Schema.Types.ObjectId, ref: 'Transcription', required: true, index: true },
  currentSegmentIndex: { type: Number, default: 0, required: true },
  completed: { type: Boolean, default: false },
  hintsUsedCount: { type: Number, default: 0 },
  incorrectAttempts: { type: Number, default: 0 },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Each user has one progress record per transcription
DictationProgressSchema.index({ userId: 1, transcriptionId: 1 }, { unique: true });

// 4. Vocabulary Schema (Nhúng FlashcardState)
const VocabularySchema = new Schema<IVocabulary>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  transcriptionId: { type: Schema.Types.ObjectId, ref: 'Transcription' },
  word: { type: String, required: true, trim: true },
  translation: { type: String, required: true },
  contextSentence: { type: String },
  notes: { type: String },
  flashcardState: {
    repetitions: { type: Number, default: 0 },
    interval: { type: Number, default: 1 },
    easeFactor: { type: Number, default: 2.5 },
    nextReviewAt: { type: Date, default: Date.now, index: true }, // Index để truy vấn nhanh hàng đợi học
    lastReviewedAt: { type: Date }
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

// Tạo phức hợp Index để tối ưu tìm kiếm từ vựng của từng User cần ôn tập
VocabularySchema.index({ userId: 1, 'flashcardState.nextReviewAt': 1 });

export const User = model<IUser>('User', UserSchema);
export const Transcription = model<ITranscription>('Transcription', TranscriptionSchema);
export const DictationProgress = model<IDictationProgress>('DictationProgress', DictationProgressSchema);
export const Vocabulary = model<IVocabulary>('Vocabulary', VocabularySchema);
