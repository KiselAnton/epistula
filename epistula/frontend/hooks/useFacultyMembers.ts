import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  fetchFacultyProfessors,
  fetchFacultyStudents,
  assignProfessorToFaculty,
  removeProfessorFromFaculty,
  assignStudentToFaculty,
  removeStudentFromFaculty
} from '../utils/faculty.api';
import { fetchUsersByRole } from '../utils/users.api';
import { FacultyProfessor, FacultyStudent, User } from '../types';

export function useFacultyMembers(universityId: string, facultyId: string) {
  const router = useRouter();
  const [professors, setProfessors] = useState<FacultyProfessor[]>([]);
  const [students, setStudents] = useState<FacultyStudent[]>([]);
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

  // Load faculty professors and students
  const loadFacultyMembers = async () => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    console.log('Loading faculty members for university', universityId, 'faculty', facultyId);
    try {
      const [profs, studs] = await Promise.all([
        fetchFacultyProfessors(universityId, facultyId, token),
        fetchFacultyStudents(universityId, facultyId, token)
      ]);
      console.log('Loaded professors:', profs);
      console.log('Loaded students:', studs);
      setProfessors(profs);
      setStudents(studs);
    } catch (error: any) {
      console.error('Error loading faculty members:', error);
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        console.error('Failed to load faculty members:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (universityId && facultyId) {
      loadFacultyMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId, facultyId]); // loadFacultyMembers is stable but not memoized; explicit dependency would cause infinite loop

  // Professor management
  const openAddProfessorModal = async () => {
    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      const allProfessors = await fetchUsersByRole(universityId, 'professor', token);
      const assignedIds = new Set(professors.map((p: FacultyProfessor) => p.professor_id));
      const available = allProfessors.filter(prof => !assignedIds.has(prof.id));
      setAvailableProfessors(available);
      setShowAddProfessorModal(true);
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        alert(error.message || 'Failed to load available professors');
      }
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
      await assignProfessorToFaculty(universityId, facultyId, professorId, token);
      await loadFacultyMembers();
      setShowAddProfessorModal(false);
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        alert(error.message || 'Failed to assign professor');
      }
    } finally {
      setAssigningProfessor(false);
    }
  };

  const handleRemoveProfessor = async (professorId: number) => {
    if (!confirm('Are you sure you want to remove this professor from the faculty?')) {
      return;
    }

    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setRemovingProfessor(professorId);
    try {
      await removeProfessorFromFaculty(universityId, facultyId, professorId, token);
      setProfessors((prev: FacultyProfessor[]) => prev.filter((p: FacultyProfessor) => p.professor_id !== professorId));
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        alert(error.message || 'Failed to remove professor');
      }
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
      const allStudents = await fetchUsersByRole(universityId, 'student', token);
      const assignedIds = new Set(students.map((s: FacultyStudent) => s.student_id));
      const available = allStudents.filter(student => !assignedIds.has(student.id));
      setAvailableStudents(available);
      setShowAddStudentModal(true);
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        alert(error.message || 'Failed to load available students');
      }
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
      await assignStudentToFaculty(universityId, facultyId, studentId, token);
      await loadFacultyMembers();
      setShowAddStudentModal(false);
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        alert(error.message || 'Failed to assign student');
      }
    } finally {
      setAssigningStudent(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!confirm('Are you sure you want to remove this student from the faculty?')) {
      return;
    }

    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setRemovingStudent(studentId);
    try {
      await removeStudentFromFaculty(universityId, facultyId, studentId, token);
      setStudents((prev: FacultyStudent[]) => prev.filter((s: FacultyStudent) => s.student_id !== studentId));
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        handleUnauthorized();
      } else {
        alert(error.message || 'Failed to remove student');
      }
    } finally {
      setRemovingStudent(null);
    }
  };

  return {
    professors,
    students,
    loading,
    // Professor modal
    showAddProfessorModal,
    setShowAddProfessorModal,
    availableProfessors,
    openAddProfessorModal,
    handleAddProfessor,
    handleRemoveProfessor,
    assigningProfessor,
    removingProfessor,
    // Student modal
    showAddStudentModal,
    setShowAddStudentModal,
    availableStudents,
    openAddStudentModal,
    handleAddStudent,
    handleRemoveStudent,
    assigningStudent,
    removingStudent,
    // expose refresher for parent components
    refreshMembers: loadFacultyMembers
  };
}
