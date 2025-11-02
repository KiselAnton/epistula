import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Lecture } from '../types';
import { getBackendUrl } from '../lib/config';

export function useLectures(
  universityId: string,
  facultyId: string,
  subjectId: string
) {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingLecture, setDeletingLecture] = useState<number | null>(null);
  const [publishingLecture, setPublishingLecture] = useState<number | null>(null);

  const getToken = (): string | null => {
    return localStorage.getItem('token');
  };

  const handleUnauthorized = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const loadLectures = async () => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/lectures`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch lectures');

      const data = await response.json();
      setLectures(data);
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        console.error('Failed to load lectures:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (universityId && facultyId && subjectId) {
      loadLectures();
    }
  }, [universityId, facultyId, subjectId]);

  const handleDeleteLecture = async (lectureId: number) => {
    if (!confirm('Are you sure you want to delete this lecture? This will also delete all content.')) {
      return;
    }

    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setDeletingLecture(lectureId);
    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/lectures/${lectureId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Failed to delete lecture');

      await loadLectures();
    } catch (error) {
      console.error('Failed to delete lecture:', error);
      alert('Failed to delete lecture');
    } finally {
      setDeletingLecture(null);
    }
  };

  const togglePublishLecture = async (lectureId: number, publish: boolean) => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setPublishingLecture(lectureId);
    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/lectures/${lectureId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_active: publish }) // maps to is_published on backend
        }
      );

      if (!response.ok) throw new Error('Failed to update lecture visibility');
      await loadLectures();
    } catch (error) {
      console.error('Failed to update lecture visibility:', error);
      alert('Failed to update lecture visibility');
    } finally {
      setPublishingLecture(null);
    }
  };

  const handleCreateLecture = async (lectureData: any) => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }

    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/lectures`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(lectureData)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create lecture');
      }

      await loadLectures();
    } catch (error: any) {
      console.error('Failed to create lecture:', error);
      throw error;
    }
  };

  return {
    lectures,
    loading,
    deletingLecture,
    handleDeleteLecture,
    handleCreateLecture,
    refreshLectures: loadLectures,
    publishingLecture,
    togglePublishLecture
  };
}
