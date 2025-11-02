import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '../components/layout/MainLayout';
import Image from 'next/image';
import SafeImage from '../components/common/SafeImage';
import MarkdownDisplay from '../components/common/MarkdownDisplay';
import MarkdownEditor from '../components/common/MarkdownEditor';
import styles from '../styles/Universities.module.css';
import { getBackendUrl } from '../lib/config';

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

export default function Universities() {
  const router = useRouter();
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: ''
  });

  // Use centralized backend URL resolver

  const fetchUniversities = useCallback(async () => {
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
        throw new Error('Failed to fetch universities');
      }

      const data: University[] = await response.json();
      // Only redirect uni_admins to their single university (not root)
      try {
        const raw = localStorage.getItem('user');
        const u = raw ? JSON.parse(raw) : null;
        if (Array.isArray(data) && data.length === 1 && u?.role === 'uni_admin') {
          router.replace(`/university/${data[0].id}`);
          return;
        }
      } catch {}

      setUniversities(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Only non-root uni_admins should be redirected to their university
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.primary_university_id && u?.role === 'uni_admin') {
          router.replace(`/university/${u.primary_university_id}`);
          return;
        }
      }
    } catch {}

    fetchUniversities();
  }, [fetchUniversities, router]);

  const handleCreateUniversity = async () => {
    setError('');
    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }
      const response = await fetch(`${getBackendUrl()}/api/v1/universities/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          description: formData.description || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create university');
      }

      const created: University = await response.json();

      // Optional logo upload
      if (logoFile) {
        try {
          const form = new FormData();
          form.append('file', logoFile);
          const up = await fetch(`${getBackendUrl()}/api/v1/universities/${created.id}/logo`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
          });
          // Ignore non-OK but surface as alert
          if (!up.ok) {
            const e = await up.json().catch(() => ({}));
            alert(e?.detail || 'Logo upload failed');
          }
        } catch (e: any) {
          // Non-fatal
          alert(e?.message || 'Logo upload error');
        }
      }

      // Reset form and close modal
      setFormData({ name: '', code: '', description: '' });
      setLogoFile(null);
      setLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setShowCreateModal(false);
      setError('');
      
      // Refresh list
      await fetchUniversities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUniversity = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete university');
      }

      setDeleteConfirm(null);
      await fetchUniversities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUniversities = universities.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(universities.length / itemsPerPage);

  if (loading) {
    return (
      <MainLayout>
        <div className={styles.loading}>Loading universities...</div>
      </MainLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Epistula -- Universities</title>
      </Head>
      <MainLayout breadcrumbs={['Universities']}>
        <div className={styles.container}>
        <div className={styles.header}>
          <h1>Universities</h1>
          <button 
            className={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            + Register New University
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.cardsContainer}>
          {currentUniversities.length === 0 ? (
            <div className={styles.noData}>
              No universities found. Create your first one!
            </div>
          ) : (
            currentUniversities.map((uni) => (
              <div 
                key={uni.id} 
                className={styles.universityCard}
                onClick={() => router.push(`/university/${uni.id}`)}
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
                      {uni.logo_url ? (
                        <SafeImage
                          src={`${getBackendUrl()}${uni.logo_url}`}
                          alt={`${uni.name} logo`}
                          width={60}
                          height={60}
                        />
                      ) : (
                        <span style={{ fontSize: '1.8rem' }}>🏛️</span>
                      )}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {uni.name}
                        {uni.schema_name?.endsWith('_temp') && (
                          <span style={{
                            background: '#ffc107',
                            color: '#212529',
                            borderRadius: 6,
                            padding: '0.1rem 0.4rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 0.2
                          }}>
                            Temporarily
                          </span>
                        )}
                      </h3>
                      <span className={styles.cardCode}>{uni.code}</span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.cardBody}>
                  {uni.description && (
                    <div className={styles.cardDescription}>
                      <MarkdownDisplay content={uni.description} variant="compact" />
                    </div>
                  )}
                  
                  <div className={styles.cardMeta}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Schema:</span>
                      <code>{uni.schema_name}</code>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Created:</span>
                      <span>{new Date(uni.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Status:</span>
                      <span className={uni.is_active ? styles.statusActive : styles.statusInactive}>
                        {uni.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(uni.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Register New University</h2>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowCreateModal(false)}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); if (!creating) handleCreateUniversity(); }}>
                <div className={styles.formGroup}>
                  <label htmlFor="name">University Name *</label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Massachusetts Institute of Technology"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="code">Code (short, e.g., MIT) *</label>
                  <input
                    id="code"
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    placeholder="e.g., MIT"
                    maxLength={10}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description">Description (Markdown, optional)</label>
                  <MarkdownEditor
                    value={formData.description}
                    onChange={(v) => setFormData({ ...formData, description: v })}
                    onSave={handleCreateUniversity}
                    isSaving={creating}
                    placeholder="Describe this university..."
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
                  <button 
                    type="button" 
                    className={styles.cancelButton}
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitButton} disabled={creating}>
                    {creating ? 'Creating…' : 'Create University'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm !== null && (
          <div className={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>⚠️ Confirm Deletion</h2>
              </div>
              
              <div className={styles.deleteWarning}>
                <p><strong>This is a serious action!</strong></p>
                <p>
                  Deleting a university will permanently remove:
                </p>
                <ul>
                  <li>The university and its logo</li>
                  <li>All faculties and their logos</li>
                  <li>All associated users, courses, and content</li>
                  <li>The entire database schema for this university</li>
                </ul>
                <p><strong>This action CANNOT be undone!</strong></p>
                <p>Are you absolutely sure you want to delete university ID {deleteConfirm}?</p>
              </div>

              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => handleDeleteUniversity(deleteConfirm)}
                >
                  Yes, Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </MainLayout>
    </>
  );
}
