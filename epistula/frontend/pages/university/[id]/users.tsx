import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Head from 'next/head';
// Dynamically import MainLayout to reduce initial bundle size
const MainLayout = dynamic(() => import('../../../components/layout/MainLayout'));
import { prefetchPatterns } from '../../../lib/api';

interface University {
  id: number;
  name: string;
  code: string;
}

interface Faculty {
  id: number;
  name: string;
  code: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: 'uni_admin' | 'professor' | 'student';
  created_at: string;
  is_active: boolean;
}

type UserRole = 'uni_admin' | 'professor' | 'student';

export default function UniversityUsersPage() {
  const router = useRouter();
  const { id, role: roleQuery, q: qQuery } = router.query as { [key: string]: any };
  const [university, setUniversity] = useState<University | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Edit user modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    password: ''
  });

  // Create user form state
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'student' as UserRole,
    faculty_id: undefined as number | undefined
  });

  const getBackendUrl = () => {
    return 'http://localhost:8000';
  };

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

  // Highlight matched text for search query
  const highlight = (text: string): JSX.Element => {
    if (!debouncedSearch) return <>{text}</>;
    try {
      const escaped = debouncedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      return (
        <>
          {parts.map((part, i) => (
            part.toLowerCase() === debouncedSearch ?
              <mark key={i} style={{ backgroundColor: '#fff3bf', padding: 0 }}>{part}</mark> :
              <span key={i}>{part}</span>
          ))}
        </>
      );
    } catch {
      return <>{text}</>;
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle validation errors from FastAPI/Pydantic
        if (errorData.detail && Array.isArray(errorData.detail)) {
          // Pydantic validation errors
          const errors = errorData.detail.map((err: any) => {
            const field = err.loc.join(' > ');
            return `${field}: ${err.msg}`;
          }).join(', ');
          throw new Error(errors);
        } else if (typeof errorData.detail === 'string') {
          throw new Error(errorData.detail);
        } else if (typeof errorData.detail === 'object') {
          throw new Error(JSON.stringify(errorData.detail));
        } else {
          throw new Error('Failed to create user');
        }
      }

  const createdUser = await response.json();
  setUsers([...users, createdUser]);
  // Also update filtered list so the new user appears immediately
  setFilteredUsers([...filteredUsers, createdUser]);
      setShowCreateModal(false);
      setNewUser({ email: '', name: '', password: '', role: 'student', faculty_id: undefined });
      setCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'An error occurred');
      setCreating(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      password: ''
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditing(true);
    setEditError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      // Update user details (name and/or password)
      const updateData: any = {};
      if (editForm.name !== editingUser.name) {
        updateData.name = editForm.name;
      }
      if (editForm.password) {
        updateData.password = editForm.password;
      }

      if (Object.keys(updateData).length === 0) {
        setShowEditModal(false);
        setEditing(false);
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.detail && Array.isArray(errorData.detail)) {
          const errors = errorData.detail.map((err: any) => {
            const field = err.loc.join(' > ');
            return `${field}: ${err.msg}`;
          }).join(', ');
          throw new Error(errors);
        } else if (typeof errorData.detail === 'string') {
          throw new Error(errorData.detail);
        } else {
          throw new Error('Failed to update user');
        }
      }

      const updatedUser = await response.json();
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setFilteredUsers(filteredUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
      setShowEditModal(false);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An error occurred');
      setEditing(false);
    }
  };

  const handleDeactivateUser = async (userId: number) => {
    if (!confirm('Are you sure you want to deactivate this user? They will no longer have access.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: false })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to deactivate user');
      }

      const updatedUser = await response.json();
      // Update user in lists with new active status
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setFilteredUsers(filteredUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate user');
    }
  };

  const handleActivateUser = async (userId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: true })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to activate user');
      }

      const updatedUser = await response.json();
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setFilteredUsers(filteredUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to activate user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to permanently remove this user from the university? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/users/${userId}`, {
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
        throw new Error(errorData.detail || 'Failed to delete user');
      }

      // Remove from lists
      setUsers(users.filter(u => u.id !== userId));
      setFilteredUsers(filteredUsers.filter(u => u.id !== userId));
      setShowEditModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Initialize role and search from URL on first load
  useEffect(() => {
    if (!router.isReady) return;
    if (roleQuery && ['all','uni_admin','professor','student'].includes(roleQuery)) {
      setSelectedRole(roleQuery as any);
    }
    if (typeof qQuery === 'string') {
      setSearch(qQuery);
      setDebouncedSearch(qQuery.toLowerCase());
    }
    
    // Get current user ID from local storage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUserId(user.id);
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
    }
  }, [router.isReady, roleQuery, qQuery]);

  useEffect(() => {
    if (!id || !router.isReady) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        // Fetch all data in parallel
        const params = new URLSearchParams();
        if (selectedRole !== 'all') params.set('role', selectedRole);
        if (debouncedSearch) params.set('q', debouncedSearch);

        const [uniResponse, facultiesResponse, usersResponse] = await Promise.all([
          fetch(`${getBackendUrl()}/api/v1/universities/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${getBackendUrl()}/api/v1/faculties/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${getBackendUrl()}/api/v1/universities/${id}/users${params.toString() ? `?${params.toString()}` : ''}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (uniResponse.status === 401 || facultiesResponse.status === 401 || usersResponse.status === 401) {
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

        // Process faculties
        if (facultiesResponse.ok) {
          const facultiesData = await facultiesResponse.json();
          setFaculties(facultiesData || []);
        } else {
          setFaculties([]);
        }

        // Process users
        if (usersResponse.ok) {
          const userData = await usersResponse.json();
          setUsers(userData.users || []);
          setFilteredUsers(userData.users || []);
        } else {
          setUsers([]);
          setFilteredUsers([]);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedRole, debouncedSearch]); // router.isReady used in guard; including router would cause infinite loops

  // Keep URL query in sync (shareable/back-forward friendly)
  useEffect(() => {
    if (!router.isReady) return;
    const desired: any = { id };
    if (selectedRole !== 'all') desired.role = selectedRole;
    if (debouncedSearch) desired.q = search;

    // Avoid redundant router.replace if query hasn't changed
    const current = router.query || {};
    const keys = new Set<string>([...Object.keys(current), ...Object.keys(desired)]);
    let changed = false;
    for (const k of Array.from(keys)) {
      if ((current as any)[k]?.toString() !== (desired as any)[k]?.toString()) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    router.replace({ pathname: router.pathname, query: desired }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, debouncedSearch, search, id]); // router used in logic; including it would cause infinite loops

  useEffect(() => {
    // Debounce search input
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  if (loading) {
    return (
      <>
        <Head>
          <title>Epistula -- Users</title>
        </Head>
        <MainLayout breadcrumbs={['Loading...']}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Loading users...</p>
          </div>
        </MainLayout>
      </>
    );
  }

  if (error || !university) {
    return (
      <>
        <Head>
          <title>Epistula -- Error</title>
        </Head>
        <MainLayout breadcrumbs={['Error']}>
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

  const adminCount = users.filter(u => u.role === 'uni_admin').length;
  const professorCount = users.filter(u => u.role === 'professor').length;
  const studentCount = users.filter(u => u.role === 'student').length;

  return (
    <>
      <Head>
        <title>Epistula -- {university.name} Users</title>
      </Head>
      <MainLayout breadcrumbs={[
        { label: university.name, href: `/university/${id}` },
        'Users'
      ]}>
        <div style={{ padding: '2rem' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ margin: 0 }}>User Management</h1>
                <p style={{ color: '#666', margin: '0.5rem 0 0 0' }}>{university.name}</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600
                }}
              >
                + Create User
              </button>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#fff5f5', border: '2px solid #dc3545', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>{adminCount}</div>
                <div style={{ color: '#666', marginTop: '0.5rem' }}>Administrators</div>
              </div>
              <div style={{ background: '#f0f7ff', border: '2px solid #007bff', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>{professorCount}</div>
                <div style={{ color: '#666', marginTop: '0.5rem' }}>Professors</div>
              </div>
              <div style={{ background: '#f0fff4', border: '2px solid #28a745', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>{studentCount}</div>
                <div style={{ color: '#666', marginTop: '0.5rem' }}>Students</div>
              </div>
            </div>

            {/* Filter Tabs + Search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e0e0e0' }}>
                {(['all', 'uni_admin', 'professor', 'student'] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: selectedRole === role ? '#667eea' : 'transparent',
                      color: selectedRole === role ? 'white' : '#666',
                      border: 'none',
                      borderBottom: selectedRole === role ? '2px solid #667eea' : '2px solid transparent',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: selectedRole === role ? 600 : 400,
                      marginBottom: '-2px'
                    }}
                  >
                    {role === 'all' ? 'All Users' : getRoleLabel(role)}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email"
                  aria-label="Search users"
                  style={{
                    padding: '0.6rem 0.9rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    minWidth: '260px'
                  }}
                />
                <span style={{ color: '#666', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                  {filteredUsers.length} result{filteredUsers.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* Users Table */}
            {filteredUsers.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Email</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Role</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Created</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr 
                        key={user.id}
                        style={{ 
                          borderBottom: index < filteredUsers.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}
                      >
                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                          <Link 
                            href={`/university/${id}/users/${user.id}`} 
                            prefetch={true}
                            legacyBehavior
                          >
                            <a
                              onMouseEnter={() => {
                                if (id) {
                                  prefetchPatterns.userDetails(String(id), user.id);
                                }
                              }}
                              style={{
                                color: '#007bff',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 500,
                                textDecoration: 'underline',
                              }}
                            >
                              {highlight(user.name)}
                            </a>
                          </Link>
                        </td>
                        <td style={{ padding: '1rem', color: '#666' }}>{highlight(user.email)}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            background: getRoleBadgeColor(user.role),
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            fontWeight: 600
                          }}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            background: user.is_active ? '#28a745' : '#6c757d',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            fontWeight: 600
                          }}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: '#666', fontSize: '0.9rem' }}>
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleEditUser(user)}
                            style={{
                              padding: '0.25rem 0.75rem',
                              background: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              marginRight: '0.5rem'
                            }}
                          >
                            Edit
                          </button>
                          {/* Hide deactivate/activate/delete buttons for current user */}
                          {currentUserId !== user.id && (
                            <>
                              {user.is_active ? (
                                <button
                                  onClick={() => handleDeactivateUser(user.id)}
                                  style={{
                                    padding: '0.25rem 0.75rem',
                                    background: '#ffc107',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    marginRight: '0.5rem'
                                  }}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleActivateUser(user.id)}
                                  style={{
                                    padding: '0.25rem 0.75rem',
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    marginRight: '0.5rem'
                                  }}
                                >
                                  Activate
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                style={{
                                  padding: '0.25rem 0.75rem',
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
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                padding: '4rem',
                textAlign: 'center',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>👥</span>
                <h3 style={{ color: '#6c757d', margin: '0 0 0.5rem 0' }}>
                  {selectedRole === 'all' ? 'No users yet' : `No ${getRoleLabel(selectedRole).toLowerCase()}s yet`}
                </h3>
                <p style={{ color: '#999', margin: 0 }}>Click &quot;Create User&quot; to add administrators, professors, or students.</p>
              </div>
            )}

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => router.push(`/university/${id}`)}
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
                ← Back to University
              </button>
            </div>
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setShowCreateModal(false)}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Create New User</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateUser}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                  <small style={{ color: '#666' }}>Minimum 6 characters</small>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Role *
                  </label>
                  <select
                    name="role"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole, faculty_id: undefined })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="student">Student</option>
                    <option value="professor">Professor</option>
                    <option value="uni_admin">Administrator</option>
                  </select>
                </div>

                {newUser.role === 'student' && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                      Faculty *
                    </label>
                    <select
                      name="faculty_id"
                      value={newUser.faculty_id || ''}
                      onChange={(e) => setNewUser({ ...newUser, faculty_id: e.target.value ? parseInt(e.target.value) : undefined })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '6px',
                        fontSize: '1rem'
                      }}
                    >
                      <option value="">Select a faculty</option>
                      {faculties.map(faculty => (
                        <option key={faculty.id} value={faculty.id}>
                          {faculty.name} ({faculty.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {createError && (
                  <div style={{
                    padding: '1rem',
                    background: '#fff5f5',
                    border: '1px solid #dc3545',
                    borderRadius: '6px',
                    color: '#dc3545',
                    marginBottom: '1rem'
                  }}>
                    {createError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: creating ? '#ccc' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: creating ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600
                    }}
                  >
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editingUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setShowEditModal(false)}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Edit User</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Email:</strong> {editingUser.email}
                </div>
                <div>
                  <strong>Role:</strong> <span style={{
                    background: getRoleBadgeColor(editingUser.role),
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>
                    {getRoleLabel(editingUser.role)}
                  </span>
                </div>
              </div>

              <form onSubmit={handleUpdateUser}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    minLength={6}
                    placeholder="Leave blank to keep current password"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                  <small style={{ color: '#666' }}>Minimum 6 characters (optional)</small>
                </div>

                {editError && (
                  <div style={{
                    padding: '1rem',
                    background: '#fff5f5',
                    border: '1px solid #dc3545',
                    borderRadius: '6px',
                    color: '#dc3545',
                    marginBottom: '1rem'
                  }}>
                    {editError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(editingUser.id)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600
                    }}
                  >
                    🗑️ Delete User
                  </button>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
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
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editing}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: editing ? '#ccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: editing ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 600
                      }}
                    >
                      {editing ? 'Updating...' : 'Update User'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </MainLayout>
    </>
  );
}
