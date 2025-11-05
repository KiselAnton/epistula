import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import MainLayout from '../../../../../components/layout/MainLayout';
import MarkdownDisplay from '../../../../../components/common/MarkdownDisplay';
import styles from '../../../../../styles/Faculties.module.css';
import buttons from '../../../../../styles/Buttons.module.css';
import ImportSubjectWizard from '../../../../../components/subject/ImportSubjectWizard';
import WysiwygMarkdownEditor from '../../../../../components/common/WysiwygMarkdownEditor';
import { getBackendUrl } from '../../../../../lib/config';

interface Subject {
  id: number;
  faculty_id: number;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
  is_active: boolean;
}

interface Faculty {
  id: number;
  name: string;
  code: string;
}

interface University {
  id: number;
  name: string;
  code: string;
}

export default function SubjectsPage() {
  const router = useRouter();
  const { id, facultyId } = router.query;
  const [university, setUniversity] = useState<University | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [creating, setCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [fav, setFav] = useState<Record<number, true>>({});

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: ''
  });

  // Use centralized backend URL resolver

  const fetchSubjects = useCallback(async () => {
    if (!id || !facultyId) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${facultyId}`, {
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
        throw new Error('Failed to fetch subjects');
      }

      const data = await response.json();
      setSubjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [id, facultyId, router]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${facultyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          description: formData.description || null
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create subject');
      }

      const created = await response.json();

      if (logoFile) {
        try {
          const form = new FormData();
          form.append('file', logoFile);
          const up = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${facultyId}/${created.id}/logo`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
          });
          if (!up.ok) {
            const e = await up.json().catch(() => ({}));
            alert(e?.detail || 'Logo upload failed');
          }
        } catch (e: any) {
          alert(e?.message || 'Logo upload error');
        }
      }

      await fetchSubjects();
      setShowCreateModal(false);
      setFormData({ name: '', code: '', description: '' });
      setLogoFile(null);
      setLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  // Debounce search input and reset pagination
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);

  const handleDelete = async (subjectId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${facultyId}/${subjectId}`, {
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
        throw new Error('Failed to delete subject');
      }

      setDeleteConfirm(null);
      await fetchSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

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
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (uniResponse.ok) {
          const universities = await uniResponse.json();
          const uni = universities.find((u: University) => u.id === parseInt(id as string));
          if (uni) {
            setUniversity(uni);
          }
        }

        // Fetch faculty
        const facultiesResponse = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (facultiesResponse.ok) {
          const faculties = await facultiesResponse.json();
          const fac = faculties.find((f: Faculty) => f.id === parseInt(facultyId as string));
          if (fac) {
            setFaculty(fac);
          }
        }

        await fetchSubjects();
        // Load favorites for this faculty
        try {
          const raw = localStorage.getItem(`fav:subjects:uni_${id}:faculty_${facultyId}`);
          if (raw) setFav(JSON.parse(raw));
        } catch {}
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchData();
  }, [id, facultyId, router, fetchSubjects]);

  if (loading) {
    return (
      <>
        <Head>
          <title>Epistula -- Subjects</title>
        </Head>
        <MainLayout breadcrumbs={['Loading...']}>
          <div className={styles.container}>
            <p>Loading subjects...</p>
          </div>
        </MainLayout>
      </>
    );
  }

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const filtered = subjects.filter(s => {
    if (!debouncedSearch) return true;
    const hay = `${s.name} ${s.code} ${s.description ?? ''}`.toLowerCase();
    return hay.includes(debouncedSearch);
  });
  const sortWithFav = (list: Subject[]) => {
    return [...list].sort((a, b) => {
      const af = fav[a.id] ? 1 : 0;
      const bf = fav[b.id] ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.name.localeCompare(b.name);
    });
  };
  const sortedFiltered = sortWithFav(filtered);
  const currentSubjects = sortedFiltered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const toggleFav = (sid: number) => {
    setFav((prev) => {
      const next = { ...prev } as Record<number, true>;
      if (next[sid]) delete next[sid]; else next[sid] = true;
      try { localStorage.setItem(`fav:subjects:uni_${id}:faculty_${facultyId}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <>
      <Head>
        <title>Epistula -- {faculty?.name} Subjects</title>
      </Head>
      <MainLayout breadcrumbs={[
        { label: university?.name || 'University', href: `/university/${id}` },
        { label: faculty?.name || 'Faculty', href: `/university/${id}/faculty/${facultyId}` }
      ]}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Subjects - {faculty?.name}</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                aria-label="Search subjects"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding:'0.5rem 0.75rem', border:'1px solid #ccc', borderRadius:6, minWidth:220 }}
              />
              <button onClick={() => setShowCreateModal(true)} className={styles.createButton}>
                + Create New Subject
              </button>
              <button onClick={() => setShowImport(true)} className={`${buttons.btn} ${buttons.btnSecondary}`} style={{ marginLeft: '0.5rem' }}>
                ⬆️ Import Subject
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📚</span>
              <p>{debouncedSearch ? 'No subjects match this search' : 'No subjects yet'}</p>
              <button onClick={() => setShowCreateModal(true)} className={styles.createButton}>
                Create your first subject
              </button>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {currentSubjects.map((subject) => (
                  <div
                    key={subject.id}
                    className={styles.facultyCard}
                    onClick={() => router.push(`/university/${id}/faculty/${facultyId}/subject/${subject.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f8f9fa',
                        fontSize: '2rem',
                        flexShrink: 0
                      }}>
                        📚
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: '1.1rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {subject.name}
                        </h3>
                        <button
                          aria-label={`Favorite ${subject.name}`}
                          title={fav[subject.id] ? 'Unfavorite' : 'Favorite'}
                          onClick={(e) => { e.stopPropagation(); toggleFav(subject.id); }}
                          style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'1.1rem', marginLeft: '0.25rem' }}
                        >
                          {fav[subject.id] ? '⭐' : '☆'}
                        </button>
                        <p style={{
                          margin: '0.25rem 0 0 0',
                          fontSize: '0.85rem',
                          color: '#666',
                          fontWeight: 600
                        }}>
                          {subject.code}
                        </p>
                      </div>
                    </div>
                    {subject.description && (
                      <div style={{
                        margin: 0,
                        fontSize: '0.9rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        <MarkdownDisplay content={subject.description} />
                      </div>
                    )}
                    <div style={{
                      marginTop: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.85rem', color: '#999' }}>
                        {new Date(subject.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(subject.id);
                        }}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2>Create New Subject</h2>
              <form onSubmit={handleCreateSubject}>
                <div className={styles.formGroup}>
                  <label>Subject Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    maxLength={255}
                    placeholder="e.g., Introduction to Computer Science"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Subject Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    maxLength={50}
                    placeholder="e.g., CS101"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Description (Markdown, optional)</label>
                  <WysiwygMarkdownEditor
                    value={formData.description}
                    onChange={(v) => setFormData({ ...formData, description: v })}
                    onSave={() => { /* submit via form button */ }}
                    isSaving={creating}
                    placeholder="Describe this subject..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Logo (optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Selected logo preview" style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 8, background: '#f8f9fa', border: '1px solid #eee' }} />
                    ) : (
                      <div style={{ width: 60, height: 60, borderRadius: 8, border: '1px dashed #ccc', display: 'grid', placeItems: 'center', color: '#888' }}>No logo</div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setLogoFile(f);
                        if (f) {
                          const reader = new FileReader();
                          reader.onload = () => setLogoPreview(reader.result as string);
                          reader.readAsDataURL(f);
                        } else {
                          setLogoPreview(null);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitButton} disabled={creating}>
                    {creating ? 'Creating…' : 'Create Subject'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Subject Wizard */}
        <ImportSubjectWizard
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          universityId={id as string}
          facultyId={facultyId as string}
          existingSubjects={subjects as any}
          onImported={fetchSubjects}
        />

        {/* Delete Confirmation Modal */}
        {deleteConfirm !== null && (
          <div className={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2>⚠️ Confirm Deletion</h2>
              <p>
                Are you sure you want to delete this subject?
              </p>
              <p className={styles.warningText}>
                <strong>Warning:</strong> This will permanently delete the subject and all associated data (lectures, content, enrollments).
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
                  Yes, Delete Subject
                </button>
              </div>
            </div>
          </div>
        )}
      </MainLayout>
    </>
  );
}
