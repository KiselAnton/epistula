import { useState } from 'react';
import styles from './CreateLectureModal.module.css';

interface CreateLectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lectureData: {
    title: string;
    description: string;
    scheduled_at: string;
    duration_minutes: number;
    content: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export default function CreateLectureModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: CreateLectureModalProps) {
  const [lectureNumber, setLectureNumber] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState('85');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!lectureNumber || !scheduledDate || !scheduledTime) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const scheduled_at = `${scheduledDate}T${scheduledTime}:00`;
      await onSubmit({
        title: lectureNumber,
        description,
        scheduled_at,
        duration_minutes: parseInt(duration),
        content
      });
      
      // Reset form
      setLectureNumber('');
      setScheduledDate('');
      setScheduledTime('');
      setDuration('85');
      setDescription('');
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lecture');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Create Lecture</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="lectureNumber">
              Lecture Number <span className={styles.required}>*</span>
            </label>
            <input
              id="lectureNumber"
              type="number"
              min="1"
              value={lectureNumber}
              onChange={(e) => setLectureNumber(e.target.value)}
              placeholder="1, 2, 3..."
              disabled={isSubmitting}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="scheduledDate">
                Date <span className={styles.required}>*</span>
              </label>
              <input
                id="scheduledDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="scheduledTime">
                Time <span className={styles.required}>*</span>
              </label>
              <input
                id="scheduledTime"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="duration">
              Duration (minutes)
            </label>
            <input
              id="duration"
              type="number"
              min="15"
              max="300"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the lecture"
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="content">
              Lecture Content (Markdown)
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Lecture Title

## Topics Covered
- Topic 1
- Topic 2

## Learning Objectives
1. Objective 1
2. Objective 2

## Materials
[Download slides](link-here)"
              rows={15}
              disabled={isSubmitting}
              className={styles.contentTextarea}
            />
            <div className={styles.hint}>
              Supports Markdown formatting
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={styles.submitButton}
            >
              {isSubmitting ? 'Creating...' : 'Create Lecture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
