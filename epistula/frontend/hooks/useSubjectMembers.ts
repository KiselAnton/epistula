import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { SubjectProfessor, SubjectStudent, User } from '../types';

const getBackendUrl = () => 'http://localhost:8000';

export function useSubjectMembers(
  universityId: string,
  facultyId: string,
  subjectId: string
) {
  const router = useRouter();
  const [professors, setProfessors] = useState<SubjectProfessor[]>([]);
  const [students, setStudents] = useState<SubjectStudent[]>([]);
  const [availableProfessors, setAvailableProfessors] = useState<User[]>([]);
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showAddProfessorModal, setShowAddProfessorModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  
  // Action states
  const [assigningProfessor, setAssigningProfessor] = useState(false);
  const [removingProfessor, setRemovingProfessor] = useState<number | null>(null);
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [removingStudent, setRemovingStudent] = useState<number | null>(null);

  const getToken = (): string | null => {
    return localStorage.getItem('token');
  };

  const handleUnauthorized = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  // Load subject professors and students
  const loadSubjectMembers = async () => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      const [profs, studs] = await Promise.all([
        fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/professors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
          if (!res.ok) throw new Error('Failed to fetch professors');
          return res.json();
        }),
        fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/students`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
          if (!res.ok) throw new Error('Failed to fetch students');
          return res.json();
        })
      ]);
      setProfessors(profs);
      setStudents(studs);
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        console.error('Failed to load subject members:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (universityId && facultyId && subjectId) {
      loadSubjectMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId, facultyId, subjectId]); // loadSubjectMembers is stable but not memoized; explicit dependency would cause infinite loop

  // Professor management
  const openAddProfessorModal = async () => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      // Get faculty professors (only they can be assigned to subjects)
      const response = await fetch(
        `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/professors`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch faculty professors');

      const facultyProfs = await response.json();
      const assignedIds = new Set(professors.map(p => p.professor_id));
      const available = facultyProfs
        .filter((p: any) => !assignedIds.has(p.professor_id))
        .map((p: any) => ({
          id: p.professor_id,
          email: p.professor_email,
          name: p.professor_name,
          is_active: p.is_active,
          is_root: false,
          created_at: ''
        }));

      setAvailableProfessors(available);
      setShowAddProfessorModal(true);
    } catch (error) {
      console.error('Failed to load available professors:', error);
      alert('Failed to load available professors');
    }
  };

  const handleAddProfessor = async (professorId: number) => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setAssigningProfessor(true);
    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/professors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ professor_id: professorId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to assign professor');
      }

      await loadSubjectMembers();
      setShowAddProfessorModal(false);
    } catch (error: any) {
      console.error('Failed to assign professor:', error);
      alert(error.message || 'Failed to assign professor');
    } finally {
      setAssigningProfessor(false);
    }
  };

  const handleRemoveProfessor = async (professorId: number) => {
    if (!confirm('Are you sure you want to remove this professor from the subject?')) {
      return;
    }

    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setRemovingProfessor(professorId);
    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/professors/${professorId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Failed to remove professor');

      await loadSubjectMembers();
    } catch (error) {
      console.error('Failed to remove professor:', error);
      alert('Failed to remove professor');
    } finally {
      setRemovingProfessor(null);
    }
  };

  // Student management
  const openAddStudentModal = async () => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      // Get faculty students (only they can enroll in subjects)
      const response = await fetch(
        `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/students`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch faculty students');

      const facultyStudents = await response.json();
      const enrolledIds = new Set(students.map(s => s.student_id));
      const available = facultyStudents
        .filter((s: any) => !enrolledIds.has(s.student_id))
        .map((s: any) => ({
          id: s.student_id,
          email: s.student_email,
          name: s.student_name,
          is_active: s.is_active,
          is_root: false,
          created_at: ''
        }));

      setAvailableStudents(available);
      setShowAddStudentModal(true);
    } catch (error) {
      console.error('Failed to load available students:', error);
      alert('Failed to load available students');
    }
  };

  const handleAddStudent = async (studentId: number) => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setAssigningStudent(true);
    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/students`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ student_id: studentId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to enroll student');
      }

      await loadSubjectMembers();
      setShowAddStudentModal(false);
    } catch (error: any) {
      console.error('Failed to enroll student:', error);
      alert(error.message || 'Failed to enroll student');
    } finally {
      setAssigningStudent(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!confirm('Are you sure you want to unenroll this student from the subject?')) {
      return;
    }

    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setRemovingStudent(studentId);
    try {
      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/students/${studentId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Failed to unenroll student');

      await loadSubjectMembers();
    } catch (error) {
      console.error('Failed to unenroll student:', error);
      alert('Failed to unenroll student');
    } finally {
      setRemovingStudent(null);
    }
  };

  return {
    professors,
    students,
    loading,
    showAddProfessorModal,
    setShowAddProfessorModal,
    availableProfessors,
    openAddProfessorModal,
    handleAddProfessor,
    handleRemoveProfessor,
    assigningProfessor,
    removingProfessor,
    showAddStudentModal,
    setShowAddStudentModal,
    availableStudents,
    openAddStudentModal,
    handleAddStudent,
    handleRemoveStudent,
    assigningStudent,
    removingStudent
  };
}
