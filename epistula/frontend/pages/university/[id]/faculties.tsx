import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import MainLayout from '../../../components/layout/MainLayout';
import SafeImage from '../../../components/common/SafeImage';
import MarkdownDisplay from '../../../components/common/MarkdownDisplay';
import styles from '../../../styles/Faculties.module.css';
import { exportFacultyFull } from '../../../utils/dataTransfer.api';
import ImportFacultyWizard from '../../../components/faculty/ImportFacultyWizard';
import buttons from '../../../styles/Buttons.module.css';
import MarkdownEditor from '../../../components/common/MarkdownEditor';
import { getBackendUrl } from '../../../lib/config';

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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [creating, setCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [fav, setFav] = useState<Record<number, true>>({});

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    code: '',
    description: ''
  });

  // Use centralized backend URL resolver

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
    // Load favorites for this university
    try {
      const raw = localStorage.getItem(`fav:faculties:uni_${id}`);
      if (raw) setFav(JSON.parse(raw));
    } catch {}
  }, [id, fetchUniversity, fetchFaculties]);

  // Debounce search input and reset pagination
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
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
          name: formData.name,
          short_name: formData.short_name,
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
        throw new Error(errorData.detail || 'Failed to create faculty');
      }

      const created: Faculty = await response.json();

      if (logoFile) {
        try {
          const form = new FormData();
          form.append('file', logoFile);
          const up = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}/${created.id}/logo`, {
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

      setShowCreateModal(false);
      setFormData({ name: '', short_name: '', code: '', description: '' });
      setLogoFile(null);
      setLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      fetchFaculties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
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
        <MainLayout breadcrumbs={['Loading...']}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Loading...</p>
          </div>
        </MainLayout>
      </>
    );
  }

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const filtered = faculties.filter(f => {
    if (!debouncedSearch) return true;
    const hay = `${f.name} ${f.short_name} ${f.code} ${f.description ?? ''}`.toLowerCase();
    return hay.includes(debouncedSearch);
  });
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const sortWithFav = (list: Faculty[]) => {
    return [...list].sort((a, b) => {
      const af = fav[a.id] ? 1 : 0;
      const bf = fav[b.id] ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.name.localeCompare(b.name);
    });
  };
  const sortedFiltered = sortWithFav(filtered);
  const currentSorted = sortedFiltered.slice(indexOfFirstItem, indexOfLastItem);
  const toggleFav = (fid: number) => {
    setFav((prev) => {
      const next = { ...prev } as Record<number, true>;
      if (next[fid]) delete next[fid]; else next[fid] = true;
      try { localStorage.setItem(`fav:faculties:uni_${id}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <>
      <Head>
        <title>Epistula -- {university.name} Faculties</title>
      </Head>
      <MainLayout breadcrumbs={[
        { label: university.name, href: `/university/${university.id}` }
      ]}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Faculties - {university.name}</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                aria-label="Search faculties"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding:'0.5rem 0.75rem', border:'1px solid #ccc', borderRadius:6, minWidth:220 }}
              />
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
            {currentSorted.length === 0 ? (
              <div className={styles.noData}>
                No faculties found{debouncedSearch ? ' for this search.' : '. Create your first one!'}
              </div>
            ) : (
              currentSorted.map((faculty) => (
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
                          <SafeImage
                            src={`${getBackendUrl()}${faculty.logo_url}`}
                            alt={`${faculty.name} logo`}
                            width={60}
                            height={60}
                          />
                        ) : (
                          <span style={{ fontSize: '1.8rem' }}>🎓</span>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <h3 style={{ margin: 0 }}>{faculty.name}</h3>
                        <button
                          aria-label={`Favorite ${faculty.name}`}
                          title={fav[faculty.id] ? 'Unfavorite' : 'Favorite'}
                          onClick={(e) => { e.stopPropagation(); toggleFav(faculty.id); }}
                          style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'1.1rem' }}
                        >
                          {fav[faculty.id] ? '⭐' : '☆'}
                        </button>
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
                  <label>Description (Markdown, optional)</label>
                  <MarkdownEditor
                    value={formData.description}
                    onChange={(v) => setFormData({ ...formData, description: v })}
                    onSave={() => { if (!creating) handleSubmit(new Event('submit') as any); }}
                    isSaving={creating}
                    placeholder="Describe this faculty..."
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
                    {creating ? 'Creating…' : 'Create Faculty'}
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
