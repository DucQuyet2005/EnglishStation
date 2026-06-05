import { Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface ITranscription {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  originalText: string;
  translatedText?: string;
  sourceUrl?: string;
  duration: number;
  language: string;
  segments?: ITranscriptionSegment[]; // Lưu chi tiết timeline từ Whisper
  createdAt: Date;
  updatedAt: Date;
}

export interface IFlashcardState {
  repetitions: number;      // Số lần ôn tập đúng liên tiếp
  interval: number;         // Khoảng thời gian chờ đến lần ôn tiếp theo (ngày)
  easeFactor: number;       // Độ dễ của từ (mặc định 2.5)
  nextReviewAt: Date;       // Ngày cần ôn tập tiếp theo
  lastReviewedAt?: Date;    // Ngày ôn tập gần nhất
}

export interface IDictationProgress {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  transcriptionId: Types.ObjectId;
  currentSegmentIndex: number;
  completed: boolean;
  hintsUsedCount: number;
  incorrectAttempts: number;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVocabulary {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  transcriptionId?: Types.ObjectId;
  word: string;
  translation: string;
  contextSentence?: string;
  notes?: string;
  flashcardState: IFlashcardState; // Nhúng trực tiếp trạng thái ôn tập
  createdAt: Date;
}
