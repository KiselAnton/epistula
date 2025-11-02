import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import MainLayout from '../../../../../../components/layout/MainLayout';
import SubjectProfessorsSection from '../../../../../../components/subject/SubjectProfessorsSection';
import SubjectStudentsSection from '../../../../../../components/subject/SubjectStudentsSection';
import LecturesSection from '../../../../../../components/subject/LecturesSection';
import AddMemberModal from '../../../../../../components/faculty/AddMemberModal';
import CreateLectureModal from '../../../../../../components/subject/CreateLectureModal';
import EditLectureModal from '../../../../../../components/subject/EditLectureModal';
import { useSubjectMembers } from '../../../../../../hooks/useSubjectMembers';
import { useLectures } from '../../../../../../hooks/useLectures';
import { Subject, Faculty, University } from '../../../../../../types';
import EditSubjectModal from '../../../../../../components/subject/EditSubjectModal';
import MarkdownDisplay from '../../../../../../components/common/MarkdownDisplay';
import { getBackendUrl } from '../../../../../../lib/config';
import ImportLectureWizard from '../../../../../../components/subject/ImportLectureWizard';
import ImportSubjectProfessorsWizard from '../../../../../../components/subject/ImportSubjectProfessorsWizard';
import ImportLectureMaterialsWizard from '../../../../../../components/subject/ImportLectureMaterialsWizard';
import ImportSubjectStudentsWizard from '../../../../../../components/subject/ImportSubjectStudentsWizard';
import { exportSubjectProfessorsFiltered, exportSubjectStudentsFiltered, exportLecturesFiltered, exportLectureMaterialsFiltered, exportSubjectStudentsLocal } from '../../../../../../utils/exportHelpers';

export default function SubjectDetailPage() {
  const router = useRouter();
  const { id, facultyId, subjectId } = router.query;
  const [subject, setSubject] = useState<Subject | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateLectureModal, setShowCreateLectureModal] = useState(false);
  const [showEditLectureModal, setShowEditLectureModal] = useState(false);
  const [selectedLectureId, setSelectedLectureId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportLectures, setShowImportLectures] = useState(false);
  const [showImportProfessors, setShowImportProfessors] = useState(false);
  const [showImportMaterials, setShowImportMaterials] = useState<{ open: boolean; lectureId: number | null }>({ open: false, lectureId: null });
  const [showImportStudents, setShowImportStudents] = useState(false);

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
    showAddStudentModal,
    setShowAddStudentModal,
    availableStudents,
    openAddStudentModal,
    handleAddStudent,
    handleRemoveStudent,
    assigningStudent,
    removingStudent
  } = useSubjectMembers((id as string) || '', (facultyId as string) || '', (subjectId as string) || '');

  const { lectures, loading: lecturesLoading, deletingLecture, handleDeleteLecture, handleCreateLecture, publishingLecture, togglePublishLecture, refreshLectures } = useLectures(
    (id as string) || '', (facultyId as string) || '', (subjectId as string) || ''
  );

  useEffect(() => {
    if (!id || !facultyId || !subjectId) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/'); return; }
        const uniResponse = await fetch(`${getBackendUrl()}/api/v1/universities/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (uniResponse.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
        if (uniResponse.ok) {
          const universities = await uniResponse.json();
          const uni = universities.find((u: University) => u.id === parseInt(id as string));
          if (uni) setUniversity(uni);
        }
        const facultiesResponse = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (facultiesResponse.ok) {
          const faculties = await facultiesResponse.json();
          const currentFaculty = faculties.find((f: Faculty) => f.id === parseInt(facultyId as string));
          if (currentFaculty) setFaculty(currentFaculty);
        }
        const subjectsResponse = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${facultyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          const currentSubject = subjectsData.find((s: Subject) => s.id === parseInt(subjectId as string));
          if (currentSubject) {
            setSubject(currentSubject);
            setDescription(currentSubject.description || '');
          } else {
            setError('Subject not found');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, facultyId, subjectId, router]);

  

  if (loading || membersLoading || lecturesLoading) {
    return <><Head><title>Epistula -- Loading...</title></Head>
      <MainLayout breadcrumbs={[{ label: 'Universities', href: '/universities' }, 'Loading...']}>
        <div style={{ padding: '2rem', textAlign: 'center' }}><p>Loading subject...</p></div>
      </MainLayout></>;
  }

  if (error || !subject || !faculty || !university) {
    return <><Head><title>Epistula -- Error</title></Head>
      <MainLayout breadcrumbs={[{ label: 'Universities', href: '/universities' }, 'Error']}>
        <div style={{ padding: '2rem' }}><h1>Error</h1>
          <p style={{ color: '#dc3545' }}>{error || 'Subject not found'}</p>
          <button onClick={() => router.push(`/university/${id}/faculty/${facultyId}/subjects`)}>Back to Subjects</button>
        </div>
      </MainLayout></>;
  }

  return <><Head><title>Epistula -- {subject.name}</title></Head>
    <MainLayout breadcrumbs={[
      { label: 'Universities', href: '/universities' },
      { label: university.name, href: `/university/${id}` },
      { label: 'Faculties', href: `/university/${id}/faculties` },
      { label: faculty.name, href: `/university/${id}/faculty/${facultyId}` },
      { label: 'Subjects', href: `/university/${id}/faculty/${facultyId}/subjects` },
      subject.name
    ]}>
      <div style={{ padding: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ marginBottom: '2rem', borderBottom: '2px solid #f0f0f0', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem' }}>📖</span>
              <div><h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>{subject.name}</h1>
                <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>Code: <strong>{subject.code}</strong></p>
              </div>
              <button onClick={() => setShowEditModal(true)} style={{ marginLeft: 'auto', padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✏️ Edit</button>
              <span style={{ background: subject.is_active ? '#28a745' : '#dc3545', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                {subject.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          {description && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '1rem', color: '#333' }}>
                📝 Subject Description
              </h2>
              <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', color: '#444' }}>
                <MarkdownDisplay content={description} />
              </div>
            </div>
          )}

          <LecturesSection 
            lectures={lectures} 
            onCreateLecture={() => setShowCreateLectureModal(true)} 
            onEditLecture={(lid) => { setSelectedLectureId(lid); setShowEditLectureModal(true); }} 
            onDeleteLecture={handleDeleteLecture} 
            deletingLecture={deletingLecture}
            onTogglePublish={togglePublishLecture}
            publishingLecture={publishingLecture}
            onImportMaterials={(lid) => setShowImportMaterials({ open: true, lectureId: lid })}
            onExportMaterials={async (lid) => { try { await exportLectureMaterialsFiltered(id as string, lid); } catch (e: any) { alert(e?.message || 'Export failed'); } }}
            onExportLectures={async () => { try { await exportLecturesFiltered(id as string, subjectId as string); } catch (e: any) { alert(e?.message || 'Export failed'); } }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setShowImportLectures(true)} style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>⬆️ Import Lectures</button>
            <button onClick={() => setShowImportProfessors(true)} style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>⬆️ Import Professors</button>
            <button onClick={async () => { try { await exportSubjectProfessorsFiltered(id as string, subjectId as string); } catch (e: any) { alert(e?.message || 'Export failed'); } }} style={{ padding: '0.5rem 1rem', background: '#5a6268', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>⬇️ Export Professors</button>
            <button onClick={async () => { try { await exportLecturesFiltered(id as string, subjectId as string); } catch (e: any) { alert(e?.message || 'Export failed'); } }} style={{ padding: '0.5rem 1rem', background: '#5a6268', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>⬇️ Export Lectures</button>
            <button onClick={() => setShowImportStudents(true)} style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>⬆️ Import Students</button>
            <button onClick={async () => { try { await exportSubjectStudentsFiltered(id as string, subjectId as string); } catch (e: any) { 
              // Fallback to local export if backend export fails
              try {
                const simple = students.map(s => ({ student_id: s.student_id, status: s.status }));
                exportSubjectStudentsLocal(id as string, subjectId as string, simple);
              } catch {}
              alert(e?.message || 'Export failed'); } }} style={{ padding: '0.5rem 1rem', background: '#5a6268', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>⬇️ Export Students</button>
          </div>
          <SubjectProfessorsSection professors={professors} universityId={id as string} onAddProfessor={openAddProfessorModal} onRemoveProfessor={handleRemoveProfessor} removingProfessor={removingProfessor} />
          <SubjectStudentsSection 
            students={students} 
            universityId={id as string} 
            onAddStudent={openAddStudentModal} 
            onRemoveStudent={handleRemoveStudent} 
            removingStudent={removingStudent}
            onImportStudents={() => setShowImportStudents(true)}
            onExportStudents={async () => { try { await exportSubjectStudentsFiltered(id as string, subjectId as string); } catch (e: any) {
              try {
                const simple = students.map(s => ({ student_id: s.student_id, status: s.status }));
                exportSubjectStudentsLocal(id as string, subjectId as string, simple);
              } catch {}
              alert(e?.message || 'Export failed');
            }}}
          />
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button onClick={() => router.push(`/university/${id}/faculty/${facultyId}/subjects`)} style={{ padding: '0.75rem 1.5rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>← Back to Subjects</button>
          </div>
        </div>
      </div>
      <AddMemberModal isOpen={showAddProfessorModal} title="Assign Professor to Subject" availableUsers={availableProfessors} onClose={() => setShowAddProfessorModal(false)} onAssign={handleAddProfessor} isAssigning={assigningProfessor} />
      <AddMemberModal isOpen={showAddStudentModal} title="Enroll Student in Subject" availableUsers={availableStudents} onClose={() => setShowAddStudentModal(false)} onAssign={handleAddStudent} isAssigning={assigningStudent} />
      <CreateLectureModal isOpen={showCreateLectureModal} onClose={() => setShowCreateLectureModal(false)} onCreate={handleCreateLecture} />
      <EditLectureModal 
        isOpen={showEditLectureModal}
        onClose={() => setShowEditLectureModal(false)}
        lecture={lectures.find(l => l.id === (selectedLectureId ?? -1)) || null}
        universityId={id as string}
        facultyId={facultyId as string}
        subjectId={subjectId as string}
        onSaved={refreshLectures}
      />
      <EditSubjectModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        subject={subject} 
        universityId={id as string} 
        facultyId={facultyId as string}
        onUpdated={(updated) => { setSubject(updated); setDescription(updated.description || ''); }}
      />
      <ImportLectureWizard
        isOpen={showImportLectures}
        onClose={() => setShowImportLectures(false)}
        universityId={id as string}
        subjectId={subjectId as string}
        onImported={refreshLectures}
      />
      <ImportSubjectProfessorsWizard
        isOpen={showImportProfessors}
        onClose={() => setShowImportProfessors(false)}
        universityId={id as string}
        subjectId={subjectId as string}
        existingProfessorIds={professors.map(p => p.id)}
        onImported={() => { setShowImportProfessors(false); }}
      />
      <ImportLectureMaterialsWizard
        isOpen={showImportMaterials.open}
        onClose={() => setShowImportMaterials({ open: false, lectureId: null })}
        universityId={id as string}
        lectureId={(showImportMaterials.lectureId ?? -1) as number}
        onImported={() => { setShowImportMaterials({ open: false, lectureId: null }); }}
      />
      <ImportSubjectStudentsWizard
        isOpen={showImportStudents}
        onClose={() => setShowImportStudents(false)}
        universityId={id as string}
        facultyId={facultyId as string}
        subjectId={subjectId as string}
        existingStudentIds={students.map(s => s.student_id)}
        onImported={() => setShowImportStudents(false)}
      />
    </MainLayout></>;
}
