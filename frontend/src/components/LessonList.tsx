/**
 * LessonList Component
 * Displays all saved transcription lessons for the current user
 * with progress bars, inline rename, and delete functionality.
 */
import { useState, useEffect, useRef } from 'react';
import { getLessons, renameLesson, deleteLesson } from '../api';
import type { LessonSummary } from '../api';
import './LessonList.css';

interface LessonListProps {
  onOpenDictation: (lessonId: string) => void;
  onBack: () => void;
}

export function LessonList({ onOpenDictation, onBack }: LessonListProps) {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const fetchLessons = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLessons();
      setLessons(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (lesson: LessonSummary) => {
    setEditingId(lesson._id);
    setEditTitle(lesson.title);
  };

  const confirmEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    try {
      await renameLesson(editingId, editTitle.trim());
      setLessons(prev =>
        prev.map(l => l._id === editingId ? { ...l, title: editTitle.trim() } : l)
      );
    } catch (err: any) {
      setError(err.message || 'Failed to rename');
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteLesson(id);
      setLessons(prev => prev.filter(l => l._id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
    setDeletingId(null);
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = (lesson: LessonSummary): number => {
    if (lesson.totalSegments === 0) return 0;
    if (lesson.completed) return 100;
    return Math.round((lesson.currentSegment / lesson.totalSegments) * 100);
  };

  return (
    <div className="lesson-list" id="lesson-list-page">
      <div className="lesson-list__header">
        <button className="lesson-list__back-btn" id="back-to-home" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="lesson-list__title">My Lessons</h1>
        <span className="lesson-list__count">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="lesson-list__error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="lesson-list__loading">
          <span className="lesson-list__spinner" />
          <p>Loading your lessons…</p>
        </div>
      ) : lessons.length === 0 ? (
        <div className="lesson-list__empty">
          <div className="lesson-list__empty-icon">📝</div>
          <h3>No lessons yet</h3>
          <p>Transcribe audio from microphone or YouTube to create your first dictation lesson.</p>
          <button className="lesson-list__create-btn" onClick={onBack}>
            Create your first lesson
          </button>
        </div>
      ) : (
        <div className="lesson-list__grid">
          {lessons.map(lesson => {
            const pct = getProgressPercent(lesson);
            const isEditing = editingId === lesson._id;
            const isDeleting = deletingId === lesson._id;

            return (
              <div
                key={lesson._id}
                className={`lesson-card ${lesson.completed ? 'lesson-card--completed' : ''}`}
                id={`lesson-${lesson._id}`}
              >
                {/* Title */}
                <div className="lesson-card__title-row">
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      className="lesson-card__edit-input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onBlur={confirmEdit}
                      maxLength={120}
                    />
                  ) : (
                    <h3
                      className="lesson-card__title"
                      onClick={() => onOpenDictation(lesson._id)}
                      title="Click to start dictation"
                    >
                      {lesson.title}
                    </h3>
                  )}
                </div>

                {/* Meta info */}
                <div className="lesson-card__meta">
                  <span className="lesson-card__meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                    {formatDuration(lesson.duration)}
                  </span>
                  <span className="lesson-card__meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                    {lesson.totalSegments} segments
                  </span>
                  <span className="lesson-card__meta-item lesson-card__lang">
                    {lesson.language?.toUpperCase()}
                  </span>
                </div>

                {/* Progress */}
                <div className="lesson-card__progress">
                  <div className="lesson-card__progress-bar">
                    <div
                      className="lesson-card__progress-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="lesson-card__progress-text">
                    {lesson.completed ? (
                      <span className="lesson-card__done">✓ Completed</span>
                    ) : (
                      `Segment ${lesson.currentSegment} / ${lesson.totalSegments} (${pct}%)`
                    )}
                  </span>
                </div>

                {/* Actions */}
                <div className="lesson-card__actions">
                  <button
                    className="lesson-card__btn lesson-card__btn--start"
                    onClick={() => onOpenDictation(lesson._id)}
                    title={lesson.completed ? 'Review' : 'Continue'}
                  >
                    {lesson.completed ? '🔄 Review' : '▶ Continue'}
                  </button>
                  <button
                    className="lesson-card__btn lesson-card__btn--edit"
                    onClick={() => startEdit(lesson)}
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    className="lesson-card__btn lesson-card__btn--delete"
                    onClick={() => handleDelete(lesson._id)}
                    disabled={isDeleting}
                    title="Delete"
                  >
                    {isDeleting ? '…' : '🗑️'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
