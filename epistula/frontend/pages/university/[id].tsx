import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import SafeImage from '../../components/common/SafeImage';
import MainLayout from '../../components/layout/MainLayout';
import MarkdownEditor from '../../components/common/MarkdownEditor';
import EditUniversityModal from '../../components/university/EditUniversityModal';
import MarkdownDisplay from '../../components/common/MarkdownDisplay';
import UniversityBackupSection from '../../components/backup/UniversityBackupSection';
import { getBackendUrl } from '../../lib/config';
import buttons from '../../styles/Buttons.module.css';

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

export default function UniversityPage() {
  const router = useRouter();
  const { id } = router.query;
  const [university, setUniversity] = useState<University | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  // Backups state (initial list; full details are handled by shared component)
  const [backups, setBackups] = useState<Array<any>>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [canRestore, setCanRestore] = useState(false);

  const [descDraft, setDescDraft] = useState<string>('');
  const [savingDesc, setSavingDesc] = useState(false);
  
  // Breadcrumb policy: root users can access the Universities list; admins cannot
  const [isRoot, setIsRoot] = useState(false);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload JPEG, PNG, SVG, or WebP image.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload logo');
      }

      const updatedUniversity = await response.json();
      setUniversity(updatedUniversity);
      setUploading(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'An error occurred');
      setUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!confirm('Are you sure you want to remove the university logo?')) {
      return;
    }

    setDeleting(true);
    setUploadError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/logo`, {
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
        throw new Error(errorData.detail || 'Failed to delete logo');
      }

      const updatedUniversity = await response.json();
      setUniversity(updatedUniversity);
      setDeleting(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'An error occurred');
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchUniversity = async () => {
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
          setDescDraft(uni.description || '');
        } else {
          setError('University not found');
        }
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    const fetchFaculties = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setFaculties(data);
        }
      } catch (err) {
        console.error('Failed to fetch faculties:', err);
      }
    };

    fetchUniversity();
    fetchFaculties();
  }, [id, router]);

  // Determine if current user can restore (root or uni_admin for this university)
  useEffect(() => {
    try {
      const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (userRaw) {
        const user = JSON.parse(userRaw);
        let canEditLocal = false;
        if (user?.role === 'root') { setIsRoot(true); canEditLocal = true; }
        // Edit rights: root or uni_admin for this university
        const uniId = parseInt(id as string);
        if (user?.role === 'root') {
          setCanEdit(true);
        } else if (user?.role === 'uni_admin') {
          if (user?.universities && Array.isArray(user.universities)) {
            const isAdmin = user.universities.includes(uniId);
            setCanEdit(isAdmin);
            canEditLocal = canEditLocal || isAdmin;
          } else if (user?.primary_university_id) {
            const isAdmin = Number(user.primary_university_id) === uniId;
            setCanEdit(isAdmin);
            canEditLocal = canEditLocal || isAdmin;
          }
        }
        // Restore permissions mirror edit permissions for now
        setCanRestore(canEditLocal);
      }
    } catch {}
  }, [id]);

  // Load backups list (for admins/root) - initial data for shared component
  useEffect(() => {
    if (!id || !canRestore) return;
    const loadBackups = async () => {
      setBackupsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/'); return; }
        const res = await fetch(`${getBackendUrl()}/api/v1/backups/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
        if (res.ok) {
          const data = await res.json();
          setBackups(Array.isArray(data.backups) ? data.backups : []);
        } else {
          setBackups([]);
        }
      } catch {
        setBackups([]);
      } finally {
        setBackupsLoading(false);
      }
    };
    loadBackups();
  }, [id, canRestore, router]);

  const handleRestore = async (backupName: string) => {
    if (!id) return;
    const proceed = confirm('This will restore the university data to the selected backup. A pre-restore backup will be created automatically. Continue?');
    if (!proceed) return;
    setRestoring(backupName);
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }
      const res = await fetch(`${getBackendUrl()}/api/v1/backups/${id}/${encodeURIComponent(backupName)}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        alert(err?.detail || 'Restore failed');
      } else {
        alert('Restore completed successfully');
        // Optionally reload backups after restore (pre-restore snapshot added)
        const reload = await fetch(`${getBackendUrl()}/api/v1/backups/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (reload.ok) {
          const data = await reload.json();
          setBackups(Array.isArray(data.backups) ? data.backups : []);
        }
      }
    } catch (e) {
      alert('Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  const handleCreateBackup = async () => {
    if (!id) return;
    const proceed = confirm('Create a manual backup now?');
    if (!proceed) return;
    
    console.log(`[University ${id}] Creating manual backup...`);
    setBackupsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) { 
        console.error(`[University ${id}] No token found, redirecting to login`);
        router.push('/'); 
        return; 
      }
      
      const res = await fetch(`${getBackendUrl()}/api/v1/backups/${id}/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401) { 
        console.error(`[University ${id}] Unauthorized, redirecting to login`);
        localStorage.removeItem('token'); 
        router.push('/'); 
        return; 
      }
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        console.error(`[University ${id}] Backup creation failed:`, err);
        alert(err?.detail || 'Backup creation failed');
      } else {
        const result = await res.json();
        console.log(`[University ${id}] Backup created successfully:`, result);
        alert('Backup created successfully!');
        
        // Reload backups list
        const reload = await fetch(`${getBackendUrl()}/api/v1/backups/${id}`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (reload.ok) {
          const data = await reload.json();
          setBackups(Array.isArray(data.backups) ? data.backups : []);
          console.log(`[University ${id}] Backups list reloaded, total: ${data.backups?.length || 0}`);
        }
      }
    } catch (e) {
      console.error(`[University ${id}] Backup creation error:`, e);
      alert('Backup creation failed');
    } finally {
      setBackupsLoading(false);
    }
  };

  if (loading) {
    const breadcrumbs = isRoot
      ? [{ label: 'Universities', href: '/universities' }, 'Loading...']
      : ['Loading...'];
    return (
      <>
        <Head>
          <title>Epistula -- University</title>
        </Head>
        <MainLayout breadcrumbs={breadcrumbs}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Loading university...</p>
          </div>
        </MainLayout>
      </>
    );
  }

  if (error || !university) {
    const breadcrumbs = isRoot
      ? [{ label: 'Universities', href: '/universities' }, 'Error']
      : ['Error'];
    return (
      <>
        <Head>
          <title>Epistula -- Error</title>
        </Head>
        <MainLayout breadcrumbs={breadcrumbs}>
          <div style={{ padding: '2rem' }}>
            <h1>Error</h1>
            <p style={{ color: '#dc3545' }}>{error || 'University not found'}</p>
            <button onClick={() => router.push('/universities')}>
              Back to Universities
            </button>
          </div>
        </MainLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Epistula -- {university.name}</title>
      </Head>
      <MainLayout breadcrumbs={isRoot ? [
        { label: 'Universities', href: '/universities' },
        university.name
      ] : [
        university.name
      ]}>
        <div style={{ padding: '2rem' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flex: 1 }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: '#f8f9fa',
                  position: 'relative'
                }}>
                  {university.logo_url ? (
                    <SafeImage
                      src={`${getBackendUrl()}${university.logo_url}`}
                      alt={`${university.name} logo`}
                      width={120}
                      height={120}
                    />
                  ) : (
                    <span style={{ fontSize: '3rem' }}>🏛️</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {university.name}
                    {university.schema_name?.endsWith('_temp') && (
                      <span style={{
                        background: '#ffc107',
                        color: '#212529',
                        borderRadius: 6,
                        padding: '0.15rem 0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>Temporarily</span>
                    )}
                  </h1>
                  <p style={{ color: '#666', margin: '0.5rem 0 0 0' }}>
                    Code: <strong>{university.code}</strong> | Schema: <code>{university.schema_name}</code>
                  </p>
                  {/* Unified editing: replace per-control buttons with a single Edit action */}
                  {canEdit && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button onClick={() => setShowEditModal(true)} className={`${buttons.btn} ${buttons.btnPrimary}`}>✏️ Edit</button>
                      {/* Placeholder space for future uni-level exports if needed */}
                    </div>
                  )}
                </div>
              </div>
              <span style={{
                background: university.is_active ? '#28a745' : '#dc3545',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontWeight: 600
              }}>
                {university.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Description is editable inside the wizard; display-only here */}
            {university.description && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Description</h3>
                <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', color: '#444' }}>
                  <MarkdownDisplay content={university.description} />
                </div>
              </div>
            )}

            {/* Backups & Restore (Root/Admin only) -- shared collapsible block */}
            {canRestore && (
              <div style={{ marginTop: '1.5rem' }}>
                <UniversityBackupSection
                  universityId={Number(id)}
                  universityName={university.name}
                  defaultCollapsed={true}
                  initialBackups={backups}
                  onChanged={() => {
                    // Optionally refresh anything else on this page after operations
                  }}
                />
              </div>
            )}

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666' }}>
                <strong>Created:</strong> {new Date(university.created_at).toLocaleString()}
              </p>
            </div>

            {/* Faculties Section */}
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Faculties</h2>
                <button
                  onClick={() => router.push(`/university/${university.id}/faculties`)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  Manage All →
                </button>
              </div>

              {faculties.length === 0 ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '2px dashed #dee2e6'
                }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎓</span>
                  <p style={{ color: '#6c757d', margin: 0 }}>No faculties yet</p>
                  <button
                    onClick={() => router.push(`/university/${university.id}/faculties`)}
                    style={{
                      marginTop: '1rem',
                      padding: '0.5rem 1.5rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  >
                    Create First Faculty
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem'
                }}>
                  {faculties.slice(0, 6).map((faculty) => (
                    <div
                      key={faculty.id}
                      onClick={() => router.push(`/university/${university.id}/faculty/${faculty.id}`)}
                      style={{
                        background: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        e.currentTarget.style.borderColor = '#667eea';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                      }}
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
                            <span style={{ fontSize: '2rem' }}>🎓</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {faculty.name}
                          </h3>
                          <p style={{
                            margin: '0.25rem 0 0 0',
                            fontSize: '0.85rem',
                            color: '#666'
                          }}>
                            {faculty.short_name}
                          </p>
                        </div>
                      </div>
                      {faculty.description && (
                        <div style={{ margin: 0, color: '#666' }}>
                          <MarkdownDisplay content={faculty.description} variant="compact" />
                        </div>
                      )}
                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e0e0e0',
                        fontSize: '0.85rem',
                        color: '#999'
                      }}>
                        Code: <strong>{faculty.code}</strong>
                      </div>
                    </div>
                  ))}
                  {faculties.length > 6 && (
                    <div
                      onClick={() => router.push(`/university/${university.id}/faculties`)}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        textAlign: 'center',
                        minHeight: '180px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <span style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>+{faculties.length - 6}</span>
                      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>More Faculties</p>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Click to view all</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <button
                onClick={() => router.push(`/university/${university.id}/faculties`)}
                style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span style={{ fontSize: '1.5rem' }}>🎓</span>
                Manage Faculties
              </button>

              <button
                onClick={() => router.push(`/university/${university.id}/users`)}
                style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span style={{ fontSize: '1.5rem' }}>👥</span>
                Manage Users
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
      <EditUniversityModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        university={university}
        onUpdated={(u) => { setUniversity(u); setDescDraft(u.description || ''); }}
      />
    </>
  );
}
