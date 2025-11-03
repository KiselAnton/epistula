/**
 * Custom React hooks for data fetching
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { universitiesApi } from '../utils/universities.api';
import { facultiesApi } from '../utils/faculties.api';
import { subjectsApi } from '../utils/subjects.api';
import { University, Faculty, Subject } from '../types';

/**
 * Hook to fetch universities
 */
export function useUniversities() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const _router = useRouter();

  const fetchUniversities = async () => {
    try {
      setLoading(true);
      const data = await universitiesApi.list();
      setUniversities(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch universities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUniversities();
  }, []);

  return { universities, loading, error, refetch: fetchUniversities };
}

/**
 * Hook to fetch a single university by ID
 */
export function useUniversity(id: string | number | undefined) {
  const [university, setUniversity] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchUniversity = async () => {
      try {
        setLoading(true);
        const data = await universitiesApi.list();
        const uni = data.find((u) => u.id === Number(id));
        setUniversity(uni || null);
        setError(uni ? '' : 'University not found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch university');
      } finally {
        setLoading(false);
      }
    };

    fetchUniversity();
  }, [id]);

  return { university, loading, error };
}

/**
 * Hook to fetch faculties for a university
 */
export function useFaculties(universityId: string | number | undefined) {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFaculties = async () => {
    if (!universityId) return;
    
    try {
      setLoading(true);
      const data = await facultiesApi.list(Number(universityId));
      setFaculties(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch faculties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculties();
  }, [universityId]);

  return { faculties, loading, error, refetch: fetchFaculties };
}

/**
 * Hook to fetch a single faculty by ID
 */
export function useFaculty(universityId: string | number | undefined, facultyId: string | number | undefined) {
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!universityId || !facultyId) return;

    const fetchFaculty = async () => {
      try {
        setLoading(true);
        const data = await facultiesApi.list(Number(universityId));
        const fac = data.find((f) => f.id === Number(facultyId));
        setFaculty(fac || null);
        setError(fac ? '' : 'Faculty not found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch faculty');
      } finally {
        setLoading(false);
      }
    };

    fetchFaculty();
  }, [universityId, facultyId]);

  return { faculty, loading, error };
}

/**
 * Hook to fetch subjects for a faculty
 */
export function useSubjects(universityId: string | number | undefined, facultyId: string | number | undefined) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSubjects = async () => {
    if (!universityId || !facultyId) return;
    
    try {
      setLoading(true);
      const data = await subjectsApi.list(Number(universityId), Number(facultyId));
      setSubjects(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [universityId, facultyId]);

  return { subjects, loading, error, refetch: fetchSubjects };
}

/**
 * Hook to fetch a single subject by ID
 */
export function useSubject(
  universityId: string | number | undefined,
  facultyId: string | number | undefined,
  subjectId: string | number | undefined
) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!universityId || !facultyId || !subjectId) return;

    const fetchSubject = async () => {
      try {
        setLoading(true);
        const data = await subjectsApi.list(Number(universityId), Number(facultyId));
        const sub = data.find((s) => s.id === Number(subjectId));
        setSubject(sub || null);
        setError(sub ? '' : 'Subject not found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch subject');
      } finally {
        setLoading(false);
      }
    };

    fetchSubject();
  }, [universityId, facultyId, subjectId]);

  return { subject, loading, error };
}
