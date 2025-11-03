import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import MainLayout from '../../../../components/layout/MainLayout';
import FacultyHeader from '../../../../components/faculty/FacultyHeader';
import SubjectsSection from '../../../../components/faculty/SubjectsSection';
import FacultyMembersSection from '../../../../components/faculty/FacultyMembersSection';
import FacultyStudentsSection from '../../../../components/faculty/FacultyStudentsSection';
import CreateStudentWizard from '../../../../components/faculty/CreateStudentWizard';
import AddMemberModal from '../../../../components/faculty/AddMemberModal';
import EditFacultyModal from '../../../../components/faculty/EditFacultyModal';
import { useFacultyMembers } from '../../../../hooks/useFacultyMembers';
import { Faculty, University, Subject } from '../../../../types';
import MarkdownDisplay from '../../../../components/common/MarkdownDisplay';
import { getBackendUrl } from '../../../../lib/config';
import { exportFacultyFull } from '../../../../utils/dataTransfer.api';


export default function FacultyPage() {
  const router = useRouter();
  const { id, facultyId } = router.query;
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateStudentWizard, setShowCreateStudentWizard] = useState(false);
  const [_descDraft, setDescDraft] = useState<string>('');
  const [_savingDesc, _setSavingDesc] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  console.log('FacultyPage render - id:', id, 'facultyId:', facultyId);

  // Use the faculty members hook - only when we have valid IDs
  const {
    professors,
    students,
    loading: membersLoading,
    showAddProfessorModal,
    setShowAddProfessorModal,
    availableProfessors,
    openAddProfessorModal,
    handleAddProfessor,
    handleRemoveProfessor,
    assigningProfessor,
    removingProfessor,
    // student flows (still available but we will use wizard instead of AddMemberModal)
    showAddStudentModal: _showAddStudentModal,
    setShowAddStudentModal: _setShowAddStudentModal,
    availableStudents: _availableStudents,
    openAddStudentModal: _openAddStudentModal,
    handleAddStudent: _handleAddStudent,
    handleRemoveStudent,
    assigningStudent: _assigningStudent,
    removingStudent,
    refreshMembers
  } = useFacultyMembers(
    (id as string) || '', 
    (facultyId as string) || ''
  );

  console.log('Professors from hook:', professors);

  useEffect(() => {
    if (!id || !facultyId) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        // Fetch university
        const uniResponse = await fetch(`${getBackendUrl()}/api/v1/universities/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (uniResponse.status === 401) {
          localStorage.removeItem('token');
          router.push('/');
          return;
        }

        if (uniResponse.ok) {
          const universities = await uniResponse.json();
          const uni = universities.find((u: University) => u.id === parseInt(id as string));
          if (uni) setUniversity(uni);
        }

        // Fetch faculties
        const facultiesResponse = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

          if (facultiesResponse.ok) {
          const faculties = await facultiesResponse.json();
          const currentFaculty = faculties.find((f: Faculty) => f.id === parseInt(facultyId as string));
          if (currentFaculty) {
            setFaculty(currentFaculty);
            setDescDraft(currentFaculty.description || '');
          } else {
            setError('Faculty not found');
          }
        }

        // Fetch subjects
        const subjectsResponse = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${facultyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          setSubjects(subjectsData);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, facultyId, router]);

  if (loading || membersLoading) {
    return (
      <>
        <Head>
          <title>Epistula -- Faculty</title>
        </Head>
        <MainLayout breadcrumbs={[
          { label: 'Universities', href: '/universities' },
          'Loading...'
        ]}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Loading faculty...</p>
          </div>
        </MainLayout>
      </>
    );
  }

  if (error || !faculty || !university) {
    return (
      <>
        <Head>
          <title>Epistula -- Error</title>
        </Head>
        <MainLayout breadcrumbs={[
          { label: 'Universities', href: '/universities' },
          'Error'
        ]}>
          <div style={{ padding: '2rem' }}>
            <h1>Error</h1>
            <p style={{ color: '#dc3545' }}>{error || 'Faculty not found'}</p>
            <button onClick={() => router.push(`/university/${id}/faculties`)}>
              Back to Faculties
            </button>
          </div>
        </MainLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Epistula -- {faculty.name}</title>
      </Head>
      <MainLayout breadcrumbs={[
        { label: 'Universities', href: '/universities' },
        { label: university.name, href: `/university/${id}` },
        { label: 'Faculties', href: `/university/${id}/faculties` },
        faculty.name
      ]}>
        <div style={{ padding: '2rem' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Faculty Header */}
            <FacultyHeader 
              faculty={faculty} 
              universityId={id as string}
              onLogoUpdate={(updatedFaculty) => setFaculty(updatedFaculty)}
            />
            <div style={{ marginTop: '0.75rem' }}>
              <button onClick={() => setShowEditModal(true)} style={{ padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✏️ Edit</button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    if (!token) { router.push('/'); return; }
                    const isTemp = !!university?.schema_name?.endsWith('_temp');
                    await exportFacultyFull(Number(id), Number(facultyId), {
                      fromTemp: isTemp,
                      token,
                      filenameHint: `university-${id}${isTemp ? '-temp' : ''}_faculty-${facultyId}_export.json`
                    });
                  } catch (e: any) {
                    alert(e?.message || 'Export failed');
                  }
                }}
                style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem', background: '#17a2b8', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                ⬇️ Export
              </button>
            </div>

            {/* Subjects Section */}
            <SubjectsSection 
              subjects={subjects} 
              universityId={id as string} 
              facultyId={facultyId as string}
              isTemp={!!university.schema_name?.endsWith('_temp')}
            />

            {/* Description is editable in the wizard; show display-only here */}
            {faculty.description && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Description</h3>
                <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', color: '#444' }}>
                  <MarkdownDisplay content={faculty.description} />
                </div>
              </div>
            )}

            {/* Faculty Members (Professors) Section */}
            <div style={{ marginTop: '2rem' }}>
              <FacultyMembersSection
                professors={professors}
                universityId={id as string}
                onAddProfessor={openAddProfessorModal}
                onRemoveProfessor={handleRemoveProfessor}
                removingProfessor={removingProfessor}
              />
            </div>

            {/* Faculty Students Section */}
            <FacultyStudentsSection
              students={students}
              universityId={id as string}
              onAddStudent={() => setShowCreateStudentWizard(true)}
              onRemoveStudent={handleRemoveStudent}
              removingStudent={removingStudent}
            />

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => router.push(`/university/${id}/faculties`)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                ← Back to Faculties
              </button>
            </div>
          </div>
        </div>

        {/* Add Professor Modal */}
        <AddMemberModal
          isOpen={showAddProfessorModal}
          title="Add Professor to Faculty"
          availableUsers={availableProfessors}
          onClose={() => setShowAddProfessorModal(false)}
          onAssign={handleAddProfessor}
          isAssigning={assigningProfessor}
        />

        {/* Create Student Wizard */}
        <CreateStudentWizard
          isOpen={showCreateStudentWizard}
          onClose={() => setShowCreateStudentWizard(false)}
          universityId={id as string}
          facultyId={facultyId as string}
          onCreated={refreshMembers}
        />
      </MainLayout>
      <EditFacultyModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        universityId={id as string}
        faculty={faculty}
        onUpdated={(f) => { setFaculty(f); setDescDraft(f.description || ''); }}
      />
    </>
  );
}
