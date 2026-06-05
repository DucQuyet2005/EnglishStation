/**
 * API Client
 * Centralized Axios instance and API methods.
 * All HTTP requests to the backend go through this module.
 */
import axios, { AxiosError } from 'axios';
import type { ApiResponse, ApiErrorResponse, TranscriptionResult, HealthStatus } from '../types';

// Base API URL — uses Vite proxy in development, env var in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Configured Axios instance with defaults */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000, // 2 minutes for large audio transcription
  headers: {
    'Accept': 'application/json',
  },
});

// Attach JWT token to every request if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('es_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Upload audio file for transcription.
 *
 * Creates a FormData with the audio blob and sends it
 * to the backend /transcribe endpoint.
 *
 * @param audioBlob - The recorded audio Blob from MediaRecorder
 * @param filename - Optional filename (defaults to recording.webm)
 * @param onProgress - Optional upload progress callback (0-100)
 * @returns Transcription result
 */
export async function transcribeAudio(
  audioBlob: Blob,
  filename: string = 'recording.webm',
  targetLang?: string,
  onProgress?: (progress: number) => void,
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, filename);
  if (targetLang) {
    formData.append('targetLang', targetLang);
  }

  try {
    const response = await apiClient.post<ApiResponse<TranscriptionResult>>(
      '/transcribe',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            onProgress(percent);
          }
        },
      },
    );

    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Check backend and Whisper service health.
 */
export async function checkHealth(): Promise<HealthStatus> {
  try {
    const response = await apiClient.get<ApiResponse<HealthStatus>>('/health');
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Parse API errors into user-friendly messages.
 */
function parseApiError(error: unknown): Error {
  if (error instanceof AxiosError) {
    // Server returned an error response
    if (error.response?.data) {
      const data = error.response.data as ApiErrorResponse;
      if (data.error?.message) {
        return new Error(data.error.message);
      }
    }

    // Network error
    if (error.code === 'ERR_NETWORK') {
      return new Error(
        'Cannot connect to the server. Please make sure the backend is running.',
      );
    }

    // Timeout
    if (error.code === 'ECONNABORTED') {
      return new Error(
        'Request timed out. Try recording a shorter audio clip.',
      );
    }

    return new Error(error.message || 'An unexpected error occurred');
  }

  return error instanceof Error ? error : new Error('An unexpected error occurred');
}

/**
 * Send YouTube URL for transcription.
 *
 * @param url - YouTube video URL
 * @returns Transcription result with YouTube metadata
 */
export async function transcribeYouTube(
  url: string,
  targetLang?: string,
): Promise<TranscriptionResult> {
  try {
    const response = await apiClient.post<ApiResponse<TranscriptionResult>>(
      '/youtube-transcribe',
      { url, targetLang },
      {
        timeout: 300_000, // 5 minutes — download + transcription
      },
    );

    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

export default apiClient;

// ============ Dictation / Lesson Management API ============

export interface LessonSummary {
  _id: string;
  title: string;
  sourceUrl?: string;
  duration: number;
  language: string;
  totalSegments: number;
  currentSegment: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DictationSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface DictationProgressData {
  currentSegmentIndex: number;
  completed: boolean;
  hintsUsedCount: number;
  incorrectAttempts: number;
  lastActiveAt: string;
}

export interface DictationWorkspaceData {
  transcription: {
    _id: string;
    title: string;
    sourceUrl?: string;
    duration: number;
    language: string;
    segments: DictationSegment[];
  };
  progress: DictationProgressData;
}

/** Get all lessons for the current user */
export async function getLessons(): Promise<LessonSummary[]> {
  try {
    const response = await apiClient.get<ApiResponse<LessonSummary[]>>('/transcriptions');
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/** Rename a lesson */
export async function renameLesson(id: string, title: string): Promise<void> {
  try {
    await apiClient.put(`/transcriptions/${id}`, { title });
  } catch (error) {
    throw parseApiError(error);
  }
}

/** Delete a lesson */
export async function deleteLesson(id: string): Promise<void> {
  try {
    await apiClient.delete(`/transcriptions/${id}`);
  } catch (error) {
    throw parseApiError(error);
  }
}

/** Get dictation progress and segments for a lesson */
export async function getDictationProgress(transcriptionId: string): Promise<DictationWorkspaceData> {
  try {
    const response = await apiClient.get<ApiResponse<DictationWorkspaceData>>(
      `/dictation/progress/${transcriptionId}`,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/** Update dictation progress */
export async function updateDictationProgress(body: {
  transcriptionId: string;
  currentSegmentIndex?: number;
  hintsUsed?: boolean;
  incorrectAttempt?: boolean;
}): Promise<DictationProgressData> {
  try {
    const response = await apiClient.post<ApiResponse<DictationProgressData>>(
      '/dictation/progress',
      body,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}
