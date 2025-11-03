import { useRouter } from 'next/router';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import MainLayout from '../../../../components/layout/MainLayout';
import { getBackendUrl } from '../../../../lib/config';
import AssignToSubjectModal from '../../../../components/users/AssignToSubjectModal';
import MarkdownEditor from '../../../../components/common/MarkdownEditor';

interface University {
  id: number;
  name: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: 'uni_admin' | 'professor' | 'student';
  created_at: string;
  is_active: boolean;
  faculty_id?: number;
}

interface Faculty {
  id: number;
  name: string;
  code: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  faculty_id: number;
  faculty_name?: string;
  can_edit?: boolean;
  assigned_at?: string;
  enrolled_at?: string;
  status?: string;
}

export default function UserDetailPage() {
  const router = useRouter();
  const { id, userId } = router.query;
  const [university, setUniversity] = useState<University | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [profile, setProfile] = useState<any | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [_refreshingSubjects, setRefreshingSubjects] = useState(false);

  // backend URL comes from lib/config (env or derived from window.location)

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'uni_admin': return '#dc3545';
      case 'professor': return '#007bff';
      case 'student': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'uni_admin': return 'Administrator';
      case 'professor': return 'Professor';
      case 'student': return 'Student';
      default: return role;
    }
  };

  useEffect(() => {
    if (!id || !userId) return;

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

        if (uniResponse.status === 401) {
          localStorage.removeItem('token');
          router.push('/');
          return;
        }

        if (!uniResponse.ok) {
          throw new Error('Failed to fetch university');
        }

        const universities = await uniResponse.json();
        const uni = universities.find((u: University) => u.id === parseInt(id as string));
        
        if (uni) {
          setUniversity(uni);
        } else {
          setError('University not found');
          setLoading(false);
          return;
        }

  // Fetch user details
        const userResponse = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (userResponse.ok) {
          const usersData = await userResponse.json();
          const userData = usersData.users.find((u: User) => u.id === parseInt(userId as string));
          
          if (userData) {
            setUser(userData);
            setEditName(userData.name);
            setEditActive(!!userData.is_active);

            // Fetch role-specific data
            if (userData.role === 'professor') {
              // Fetch subjects this professor teaches
              const teachResp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/teaching-subjects`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (teachResp.ok) {
                const teachData = await teachResp.json();
                setSubjects(teachData || []);
              } else if (teachResp.status === 401) {
                localStorage.removeItem('token');
                router.push('/');
                return;
              } else {
                setSubjects([]);
              }
              
              // Fetch all faculties to show where they work
              const facultiesResponse = await fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (facultiesResponse.ok) {
                const facultiesData = await facultiesResponse.json();
                setFaculties(facultiesData || []);
              }
            } else if (userData.role === 'student') {
              // Fetch subjects this student is enrolled in
              const enrollResp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/enrolled-subjects`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (enrollResp.ok) {
                const enrollData = await enrollResp.json();
                setSubjects(enrollData || []);
              } else if (enrollResp.status === 401) {
                localStorage.removeItem('token');
                router.push('/');
                return;
              } else {
                setSubjects([]);
              }
            }
            // Fetch profile (for all roles for now)
            const profResp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/profile`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (profResp.ok) {
              const p = await profResp.json();
              setProfile(p);
            }
          } else {
            setError('User not found');
          }
        } else {
          setError('Failed to fetch user data');
        }
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchData();
  }, [id, userId, router]);

  if (loading) {
    return (
      <>
        <Head>
          <title>Epistula -- User Details</title>
        </Head>
        <MainLayout breadcrumbs={[
          { label: 'Universities', href: '/universities' },
          { label: 'Loading...', href: '#' },
          { label: 'Users', href: '#' },
          'Loading...'
        ]}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Loading user details...</p>
          </div>
        </MainLayout>
      </>
    );
  }

  if (error || !university || !user) {
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
            <p style={{ color: '#dc3545' }}>{error || 'User not found'}</p>
            <button
              onClick={() => router.push(`/university/${id}/users`)}
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
              Back to Users
            </button>
          </div>
        </MainLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Epistula -- {user.name}</title>
      </Head>
      <MainLayout breadcrumbs={[
        { label: 'Universities', href: '/universities' },
        { label: university.name, href: `/university/${id}` },
        { label: 'Users', href: `/university/${id}/users` },
        user.name
      ]}>
        <div style={{ padding: '2rem' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ margin: '0 0 0.5rem 0' }}>{user.name}</h1>
                <p style={{ color: '#666', margin: 0 }}>{user.email}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{
                  background: getRoleBadgeColor(user.role),
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontWeight: 600
                }}>
                  {getRoleLabel(user.role)}
                </span>
                <span style={{
                  background: user.is_active ? '#28a745' : '#6c757d',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontWeight: 600
                }}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666' }}>
                <strong>Member since:</strong> {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          
            {/* Edit User Section */}
            <div style={{ marginTop: '1.5rem', background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Edit User</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>New Password</label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep unchanged"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input id="active" type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                <label htmlFor="active">Active in this university</label>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={async () => {
                    setSaveMsg('');
                    setSaving(true);
                    try {
                      const token = localStorage.getItem('token');
                      if (!token) { router.push('/'); return; }
                      const body: any = { name: editName, is_active: editActive };
                      if (editPassword.trim().length > 0) body.password = editPassword;
                      const res = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                      });
                      if (res.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({} as any));
                        setSaveMsg(err?.detail || 'Failed to save');
                        return;
                      }
                      const updated: User = await res.json();
                      setUser(updated);
                      setEditName(updated.name);
                      setEditActive(updated.is_active);
                      setEditPassword('');
                      setSaveMsg('Saved');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  style={{ padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saveMsg && <span style={{ color: saveMsg === 'Saved' ? '#28a745' : '#dc3545' }}>{saveMsg}</span>}
              </div>
            </div>
          </div>

          {/* Role-specific content */}
          {/* Profile section */}
          {user && profile && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              marginBottom: '2rem'
            }}>
              <h2 style={{ marginTop: 0 }}>Profile</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {user.role === 'professor' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>Working hours</label>
                      <input type="text" value={profile.working_hours || ''} onChange={e => setProfile({ ...profile, working_hours: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>Room</label>
                      <input type="text" value={profile.room || ''} onChange={e => setProfile({ ...profile, room: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }} />
                    </div>
                    <div style={{ gridColumn: '1 / span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>Bio (Markdown)</label>
                      <MarkdownEditor
                        value={profile.bio || ''}
                        onChange={(v) => setProfile({ ...profile, bio: v })}
                        onSave={async () => {
                          setProfileSaving(true);
                          try {
                            const token = localStorage.getItem('token');
                            if (!token) { router.push('/'); return; }
                            const resp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/profile`, {
                              method: 'PATCH',
                              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                              body: JSON.stringify(profile)
                            });
                            if (resp.ok) {
                              const p = await resp.json();
                              setProfile(p);
                            } else if (resp.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
                            else { alert('Failed to save profile'); }
                          } finally { setProfileSaving(false); }
                        }}
                        isSaving={profileSaving}
                        placeholder="Add a professional bio, research interests, office hours..."
                      />
                    </div>
                  </>
                )}
                {user.role === 'student' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>Speciality</label>
                      <input type="text" value={profile.speciality || ''} onChange={e => setProfile({ ...profile, speciality: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>Program</label>
                      <input type="text" value={profile.program || ''} onChange={e => setProfile({ ...profile, program: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>Major</label>
                      <input type="text" value={profile.major || ''} onChange={e => setProfile({ ...profile, major: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }} />
                    </div>
                  </>
                )}
                {/* Common avatar section */}
                <div style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    {profile.profile_image_url ? (
                      <Image src={`${getBackendUrl()}${profile.profile_image_url}`} alt="Profile" width={84} height={84} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }} />
                    ) : (
                      <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#f1f3f5', border: '2px dashed #ccc', display: 'grid', placeItems: 'center', color: '#99a' }}>No image</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <label style={{ padding: '0.5rem 0.9rem', background: '#007bff', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                      {avatarUploading ? 'Uploading…' : (profile.profile_image_url ? 'Change Image' : 'Upload Image')}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAvatarUploading(true);
                        try {
                          const token = localStorage.getItem('token');
                          if (!token) { router.push('/'); return; }
                          const form = new FormData();
                          form.append('file', file);
                          const resp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/profile-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form });
                          if (resp.ok) {
                            const p = await resp.json();
                            setProfile(p);
                          } else if (resp.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
                          else { alert('Failed to upload image'); }
                        } finally { setAvatarUploading(false); }
                      }} />
                    </label>
                    {profile.profile_image_url && (
                      <button onClick={async () => {
                        if (!confirm('Remove current image?')) return;
                        const token = localStorage.getItem('token');
                        if (!token) { router.push('/'); return; }
                        const resp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/profile-image`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                        if (resp.ok) { const p = await resp.json(); setProfile(p); } else if (resp.status === 401) { localStorage.removeItem('token'); router.push('/'); return; } else { alert('Failed to delete'); }
                      }} style={{ padding: '0.5rem 0.9rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Remove</button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <button onClick={async () => {
                  setProfileSaving(true);
                  try {
                    const token = localStorage.getItem('token');
                    if (!token) { router.push('/'); return; }
                    const resp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/profile`, {
                      method: 'PATCH',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify(profile)
                    });
                    if (resp.ok) {
                      const p = await resp.json();
                      setProfile(p);
                    } else if (resp.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
                    else { alert('Failed to save profile'); }
                  } finally { setProfileSaving(false); }
                }} disabled={profileSaving} style={{ padding: '0.5rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{profileSaving ? 'Saving…' : 'Save Profile'}</button>
              </div>
            </div>
          )}
          {user.role === 'uni_admin' && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}>
              <h2>Administrator Permissions</h2>
              <p style={{ color: '#666' }}>
                This user has full administrative access to {university.name}.
              </p>
              <ul style={{ color: '#666' }}>
                <li>Manage all users (create, edit, deactivate)</li>
                <li>Manage faculties and subjects</li>
                <li>View all content and data</li>
              </ul>
            </div>
          )}

          {user.role === 'professor' && (
            <>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                marginBottom: '2rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>Teaching Subjects</h2>
                  <button onClick={() => setShowAssignModal(true)} style={{ padding: '0.5rem 1rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ Assign to Subject</button>
                </div>
                {subjects.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    {subjects.map(subject => (
                      <div
                        key={subject.id}
                        style={{
                          padding: '1.5rem',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative'
                        }}
                        onClick={() => router.push(`/university/${id}/faculty/${subject.faculty_id}/subject/${subject.id}`)}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = '#007bff';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,123,255,0.1)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = '#e0e0e0';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <button
                          onClick={async (ev) => {
                            ev.stopPropagation();
                            if (!confirm(`Unassign ${user.name} from ${subject.name}?`)) return;
                            const token = localStorage.getItem('token');
                            if (!token) { router.push('/'); return; }
                            try {
                              const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${subject.faculty_id}/${subject.id}/professors/${userId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              if (!resp.ok) {
                                if (resp.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
                                const err = await resp.json().catch(() => ({} as any));
                                alert(err?.detail || 'Failed to unassign');
                                return;
                              }
                              setSubjects(prev => prev.filter(s => s.id !== subject.id));
                            } catch {
                              alert('Failed to unassign');
                            }
                          }}
                          title="Unassign from this subject"
                          style={{ position: 'absolute', top: 10, right: 10, padding: '0.35rem 0.6rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Unassign
                        </button>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>{subject.name}</h3>
                        <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                          Code: <strong>{subject.code}</strong>
                        </p>
                        {subject.faculty_name && (
                          <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                            Faculty: {subject.faculty_name}
                          </p>
                        )}
                        {subject.can_edit && (
                          <span style={{ color: '#28a745', fontSize: '0.85rem' }}>✓ Can edit</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px dashed #dee2e6',
                    marginTop: '1rem'
                  }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📚</span>
                    <p style={{ color: '#6c757d', margin: 0 }}>Not teaching any subjects yet</p>
                  </div>
                )}
              </div>
            </>
          )}

          {user.role === 'student' && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Enrolled Subjects</h2>
                <button onClick={() => setShowAssignModal(true)} style={{ padding: '0.5rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ Enroll in Subject</button>
              </div>
              {subjects.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {subjects.map(subject => (
                    <div
                      key={subject.id}
                      style={{
                        padding: '1.5rem',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onClick={() => router.push(`/university/${id}/faculty/${subject.faculty_id}/subject/${subject.id}`)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#28a745';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(40,167,69,0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <button
                        onClick={async (ev) => {
                          ev.stopPropagation();
                          if (!confirm(`Unenroll ${user.name} from ${subject.name}?`)) return;
                          const token = localStorage.getItem('token');
                          if (!token) { router.push('/'); return; }
                          try {
                            const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${id}/${subject.faculty_id}/${subject.id}/students/${userId}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (!resp.ok) {
                              if (resp.status === 401) { localStorage.removeItem('token'); router.push('/'); return; }
                              const err = await resp.json().catch(() => ({} as any));
                              alert(err?.detail || 'Failed to unenroll');
                              return;
                            }
                            setSubjects(prev => prev.filter(s => s.id !== subject.id));
                          } catch {
                            alert('Failed to unenroll');
                          }
                        }}
                        title="Unenroll from this subject"
                        style={{ position: 'absolute', top: 10, right: 10, padding: '0.35rem 0.6rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Unenroll
                      </button>
                      <h3 style={{ margin: '0 0 0.5rem 0' }}>{subject.name}</h3>
                      <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                        Code: <strong>{subject.code}</strong>
                      </p>
                      {subject.faculty_name && (
                        <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                          Faculty: {subject.faculty_name}
                        </p>
                      )}
                      {subject.status && (
                        <span style={{
                          background: subject.status === 'active' ? '#28a745' : '#6c757d',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem'
                        }}>
                          {subject.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '2px dashed #dee2e6',
                  marginTop: '1rem'
                }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📖</span>
                  <p style={{ color: '#6c757d', margin: 0 }}>Not enrolled in any subjects yet</p>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <button
              onClick={() => router.push(`/university/${id}/users`)}
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
              ← Back to Users
            </button>
          </div>
        </div>
        <AssignToSubjectModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          universityId={id as string}
          userId={userId as string}
          mode={user.role === 'professor' ? 'professor' : 'student'}
          faculties={faculties}
          excludeSubjectIds={subjects.map(s => s.id)}
          onAssigned={async () => {
            setRefreshingSubjects(true);
            try {
              const token = localStorage.getItem('token');
              if (!token) { router.push('/'); return; }
              if (user.role === 'professor') {
                const teachResp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/teaching-subjects`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (teachResp.ok) setSubjects(await teachResp.json());
              } else if (user.role === 'student') {
                const enrollResp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}/enrolled-subjects`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (enrollResp.ok) setSubjects(await enrollResp.json());
              }
            } finally { setRefreshingSubjects(false); }
          }}
        />
      </MainLayout>
    </>
  );
}
