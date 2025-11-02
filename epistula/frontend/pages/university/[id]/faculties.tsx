import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import MainLayout from '../../../components/layout/MainLayout';
import Image from 'next/image';
import MarkdownDisplay from '../../../components/common/MarkdownDisplay';
import styles from '../../../styles/Faculties.module.css';
import { exportFacultyFull } from '../../../utils/dataTransfer.api';
import ImportFacultyWizard from '../../../components/faculty/ImportFacultyWizard';
import buttons from '../../../styles/Buttons.module.css';

interface Faculty {
  id: number;
  university_id: number;
  name: string;
  short_name: string;
  code: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  is_active: boolean;
}

interface University {
  id: number;
  name: string;
  code: string;
  schema_name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  is_active: boolean;
}

export default function FacultiesPage() {
  const router = useRouter();
  const { id } = router.query;
  const [university, setUniversity] = useState<University | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    code: '',
    description: ''
  });

  const getBackendUrl = () => {
    return 'http://localhost:8000';
  };

  const fetchUniversity = useCallback(async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch university');
      }

      const data = await response.json();
      const uni = data.find((u: University) => u.id === parseInt(id as string));
      
      if (uni) {
        setUniversity(uni);
      } else {
        setError('University not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [id, router]);

  const fetchFaculties = useCallback(async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch faculties');
      }

      const data = await response.json();
      setFaculties(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!id) return;
    fetchUniversity();
    fetchFaculties();
  }, [id, fetchUniversity, fetchFaculties]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          code: formData.code.toUpperCase()
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create faculty');
      }

      setShowCreateModal(false);
      setFormData({ name: '', short_name: '', code: '', description: '' });
      fetchFaculties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (facultyId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}/${facultyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete faculty');
      }

      setDeleteConfirm(null);
      fetchFaculties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleExportFaculty = async (facultyId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }
      const isTemp = !!university?.schema_name?.endsWith('_temp');
      await exportFacultyFull(Number(id), facultyId, {
        fromTemp: isTemp,
        token,
        filenameHint: `university-${id}${isTemp ? '-temp' : ''}_faculty-${facultyId}_export.json`
      });
    } catch (e: any) {
      alert(e?.message || 'Export failed');
    }
  };

  if (loading || !university) {
    return (
      <>
        <Head>
          <title>Epistula -- Faculties</title>
        </Head>
        <MainLayout breadcrumbs={[
          { label: 'Universities', href: '/universities' },
          'Loading...'
        ]}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Loading...</p>
          </div>
        </MainLayout>
      </>
    );
  }

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentFaculties = faculties.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(faculties.length / itemsPerPage);

  return (
    <>
      <Head>
        <title>Epistula -- {university.name} Faculties</title>
      </Head>
      <MainLayout breadcrumbs={[
        { label: 'Universities', href: '/universities' },
        { label: university.name, href: `/university/${university.id}` },
        'Faculties'
      ]}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Faculties - {university.name}</h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowCreateModal(true)} className={styles.createButton}>
                + Create New Faculty
              </button>
              <button onClick={() => setShowImportModal(true)} className={`${buttons.btn} ${buttons.btnPrimary}`}>
                ⬇️ Import Faculty
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.cardsContainer}>
            {currentFaculties.length === 0 ? (
              <div className={styles.noData}>
                No faculties found. Create your first one!
              </div>
            ) : (
              currentFaculties.map((faculty) => (
                <div 
                  key={faculty.id} 
                  className={styles.facultyCard}
                  onClick={() => router.push(`/university/${id}/faculty/${faculty.id}`)}
                >
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        background: '#f8f9fa',
                        flexShrink: 0
                      }}>
                        {faculty.logo_url ? (
                          <Image
                            src={`${getBackendUrl()}${faculty.logo_url}`}
                            alt={`${faculty.name} logo`}
                            width={60}
                            height={60}
                            style={{ objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '1.8rem' }}>🎓</span>
                        )}
                      </div>
                      <div>
                        <h3 style={{ margin: 0 }}>{faculty.name}</h3>
                        <span className={styles.cardCode}>{faculty.code}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.cardBody}>
                    {faculty.description && (
                      <div className={styles.cardDescription}>
                        <MarkdownDisplay content={faculty.description} variant="compact" />
                      </div>
                    )}
                    
                    <div className={styles.cardMeta}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Short Name:</span>
                        <span>{faculty.short_name}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Created:</span>
                        <span>{new Date(faculty.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Status:</span>
                        <span className={faculty.is_active ? styles.statusActive : styles.statusInactive}>
                          {faculty.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.cardActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportFaculty(faculty.id);
                      }}
                      className={styles.createButton}
                      title="Export this faculty with related data"
                    >
                      Export
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(faculty.id);
                      }}
                      className={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2>Create New Faculty</h2>
              <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                  <label>Faculty Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Faculty of Computer Science"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Short Name</label>
                  <input
                    type="text"
                    value={formData.short_name}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    required
                    maxLength={50}
                    placeholder="e.g., CS Faculty"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Code (uppercase)</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    maxLength={50}
                    placeholder="e.g., FCS"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Description (optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    placeholder="Brief description of the faculty..."
                  />
                </div>

                <div className={styles.modalActions}>
                  <button type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitButton}>
                    Create Faculty
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteConfirm !== null && (
          <div className={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2>⚠️ Confirm Deletion</h2>
              <p>
                Are you sure you want to delete this faculty?
              </p>
              <p className={styles.warningText}>
                <strong>Warning:</strong> This will permanently delete the faculty, its logo, and all associated data (subjects, courses, content).
                This action cannot be undone!
              </p>
              <div className={styles.modalActions}>
                <button onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className={styles.deleteConfirmButton}
                >
                  Yes, Delete Faculty
                </button>
              </div>
            </div>
          </div>
        )}
      </MainLayout>
      {showImportModal && (
        <ImportFacultyWizard
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          universityId={id as string}
          existingFaculties={faculties}
          onImported={() => { setShowImportModal(false); fetchFaculties(); }}
        />
      )}
    </>
  );
}
