import { useCallback, useEffect, useMemo, useState } from 'react';
import DataTransferPanel from './DataTransferPanel';
import styles from '../../styles/Backups.module.css';
import { getBackendUrl } from '../../lib/config';

export interface BackupInfo {
  name: string;
  size_bytes: number;
  created_at: string;
  in_minio: boolean;
  university_id: number;
  university_name: string;
  title?: string | null;
  description?: string | null;
}

interface TempStatus {
  university_id: number;
  university_name: string;
  has_temp_schema: boolean;
  temp_university_id?: number | null;
  temp_info?: { faculty_count?: number; user_count?: number; error?: string } | null;
}

interface Props {
  universityId: number;
  universityName: string;
  defaultCollapsed?: boolean;
  initialBackups?: any[];
  onChanged?: () => void;
}

export default function UniversityBackupSection({
  universityId,
  universityName,
  defaultCollapsed = true,
  initialBackups,
  onChanged,
}: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>(initialBackups || []);
  const [tempStatus, setTempStatus] = useState<TempStatus | null>(null);

  // action state
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [promoting, setPromoting] = useState<boolean>(false);
  const [deletingTemp, setDeletingTemp] = useState<boolean>(false);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [restoringTempKey, setRestoringTempKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<Record<string, { title: string; description: string; saving: boolean }>>({});

  const backend = useMemo(() => getBackendUrl(), []);

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || `Failed to fetch backups (HTTP ${resp.status})`);
      }
      const data = await resp.json();
      const list: BackupInfo[] = (data?.backups || []).map((b: any) => ({
        ...b,
        university_id: universityId,
        university_name: universityName,
      }));
      setBackups(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [backend, universityId, universityName]);

  const refreshTempStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/temp-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setTempStatus(data as TempStatus);
      }
    } catch {}
  }, [backend, universityId]);

  useEffect(() => {
    // If we don't have initial backups, load them; always get temp status
    if (!initialBackups) {
      fetchBackups();
    }
    refreshTempStatus();
  }, [fetchBackups, refreshTempStatus, initialBackups]);

  const formatDate = (iso: string) => new Date(iso).toLocaleString();
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleCreateBackup = async () => {
    if (!confirm(`Create a new backup for "${universityName}" now?`)) return;
    setCreatingBackup(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Backup creation failed');
      }
      alert('✅ Backup created');
      await fetchBackups();
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Backup creation failed'}`);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handlePromoteTemp = async () => {
    if (!confirm(`⚠️ Promote TEMP → LIVE for "${universityName}"?\n\nA safety backup will be created automatically.`)) return;
    setPromoting(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/promote-temp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Promotion failed');
      }
      alert('✅ Temp promoted to production');
      await fetchBackups();
      await refreshTempStatus();
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Promotion failed'}`);
    } finally {
      setPromoting(false);
    }
  };

  const handleDeleteTemp = async () => {
    if (!confirm(`Delete temporary schema for "${universityName}"?`)) return;
    setDeletingTemp(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/temp-schema`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Deletion failed');
      }
      alert('✅ Temporary schema deleted');
      await refreshTempStatus();
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Deletion failed'}`);
    } finally {
      setDeletingTemp(false);
    }
  };

  const handleRestore = async (backupName: string, toTemp: boolean) => {
    const label = toTemp ? 'temporary (safe)' : 'LIVE (dangerous)';
    if (!confirm(`Restore ${label} for "${universityName}" from backup:\n${backupName}?`)) return;
    const key = `${universityId}-${backupName}`;
    toTemp ? setRestoringTempKey(key) : setRestoringKey(key);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/${encodeURIComponent(backupName)}/restore?to_temp=${toTemp ? 'true' : 'false'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Restore failed');
      }
      alert('✅ Restore started');
      await refreshTempStatus();
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Restore failed'}`);
    } finally {
      toTemp ? setRestoringTempKey(null) : setRestoringKey(null);
    }
  };

  const handleUploadToMinio = async (backupName: string) => {
    const key = `${universityId}-${backupName}`;
    setUploadingKey(key);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/${encodeURIComponent(backupName)}/upload-to-minio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Upload failed');
      }
      alert('✅ Uploaded to MinIO');
      await fetchBackups();
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Upload failed'}`);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDeleteBackup = async (backupName: string) => {
    if (!confirm(`Delete backup ${backupName}? This will remove local file and MinIO object (if any).`)) return;
    const key = `${universityId}-${backupName}`;
    setDeletingKey(key);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/${encodeURIComponent(backupName)}?delete_from_minio=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Deletion failed');
      }
      alert('✅ Backup deleted');
      await fetchBackups();
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Deletion failed'}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const startEditMeta = async (backup: BackupInfo) => {
    const key = `${universityId}-${backup.name}`;
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/${encodeURIComponent(backup.name)}/meta`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let title = backup.title ?? '';
      let description = backup.description ?? '';
      if (resp.ok) {
        const data = await resp.json();
        title = data.title ?? '';
        description = data.description ?? '';
      }
      setEditingMeta((prev) => ({ ...prev, [key]: { title, description, saving: false } }));
    } catch (e) {
      setEditingMeta((prev) => ({ ...prev, [key]: { title: backup.title ?? '', description: backup.description ?? '', saving: false } }));
    }
  };

  const cancelEditMeta = (backupName: string) => {
    const key = `${universityId}-${backupName}`;
    setEditingMeta((prev) => {
      const cp = { ...prev };
      delete cp[key];
      return cp;
    });
  };

  const saveMeta = async (backupName: string) => {
    const key = `${universityId}-${backupName}`;
    const meta = editingMeta[key];
    if (!meta) return;
    setEditingMeta((prev) => ({ ...prev, [key]: { ...meta, saving: true } }));
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/${encodeURIComponent(backupName)}/meta`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: meta.title || null, description: meta.description || null }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Failed to save');
      }
      alert('✅ Saved backup details');
      await fetchBackups();
      cancelEditMeta(backupName);
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Failed to save'}`);
      setEditingMeta((prev) => ({ ...prev, [key]: { ...(prev[key] || { title: '', description: '', saving: false }), saving: false } }));
    }
  };

  const hasTemp = !!tempStatus?.has_temp_schema;

  return (
    <div className={styles.universitySection}>
      <div className={styles.universityHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={styles.toggleButton}
            title={collapsed ? 'Expand section' : 'Collapse section'}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <h2 className={styles.universityName}>
            {universityName}
            <span className={styles.backupCount}>({backups.length} backups)</span>
            {hasTemp && (
              <span className={styles.tempBadge} title="Has temporary restore ready for validation">
                🔍 Temp Schema Active
              </span>
            )}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasTemp && (
            <>
              <button onClick={handlePromoteTemp} disabled={promoting} className={styles.promoteButton} title="Promote temporary schema to production">
                {promoting ? '⏳ Promoting...' : '✅ Promote to Live'}
              </button>
              <button onClick={handleDeleteTemp} disabled={deletingTemp} className={styles.deleteButton} title="Delete temporary schema">
                {deletingTemp ? '⏳ Deleting...' : '🗑️ Discard Temp'}
              </button>
            </>
          )}
          <button onClick={handleCreateBackup} disabled={creatingBackup} className={styles.backupNowButton} title="Create a new backup immediately">
            {creatingBackup ? '⏳ Creating...' : '💾 Backup Now'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {hasTemp && tempStatus?.temp_info && (
            <div className={styles.tempInfo}>
              <strong>📋 Temporary Schema Info:</strong>{' '}
              Faculties: {tempStatus.temp_info?.faculty_count || 0}
              {', '}Users: {tempStatus.temp_info?.user_count || 0} (Ready for validation)
            </div>
          )}

          {hasTemp && (
            <DataTransferPanel
              universityId={universityId}
              universityName={universityName}
              hasTempSchema={hasTemp}
              onTransferComplete={() => {
                fetchBackups();
                refreshTempStatus();
                onChanged?.();
              }}
            />
          )}

          <div className={styles.backupsTable}>
            {loading ? (
              <p style={{ padding: '1rem' }}>Loading backups…</p>
            ) : backups.length === 0 ? (
              <p style={{ padding: '1rem', color: '#666' }}>No backups yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Backup</th>
                    <th>Created</th>
                    <th>Size</th>
                    <th>Storage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => {
                    const key = `${universityId}-${backup.name}`;
                    const isRestoring = restoringKey === key;
                    const isRestoringToTemp = restoringTempKey === key;
                    const isUploading = uploadingKey === key;
                    const isDeleting = deletingKey === key;

                    return (
                      <tr key={backup.name}>
                        <td className={styles.backupName}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontWeight: 600 }}>{backup.title?.trim() ? backup.title : '(no title)'}</div>
                            <div style={{ fontSize: 12, color: '#666' }} title={backup.name}>
                              {backup.name}
                            </div>
                            {editingMeta[key] ? (
                              <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                                <input
                                  type="text"
                                  placeholder="Title"
                                  value={editingMeta[key].title}
                                  onChange={(e) =>
                                    setEditingMeta((prev) => ({ ...prev, [key]: { ...prev[key], title: e.target.value } }))
                                  }
                                  style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
                                />
                                <textarea
                                  placeholder="Description / notes"
                                  value={editingMeta[key].description}
                                  onChange={(e) =>
                                    setEditingMeta((prev) => ({ ...prev, [key]: { ...prev[key], description: e.target.value } }))
                                  }
                                  rows={2}
                                  style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => saveMeta(backup.name)} disabled={editingMeta[key].saving} className={styles.saveButton}>
                                    {editingMeta[key].saving ? 'Saving...' : '💾 Save'}
                                  </button>
                                  <button onClick={() => cancelEditMeta(backup.name)} className={styles.cancelButton}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: 4 }}>
                                <button onClick={() => startEditMeta(backup)} className={styles.editButton}>
                                  ✏️ Edit details
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>{formatDate(backup.created_at)}</td>
                        <td>{formatBytes(backup.size_bytes)}</td>
                        <td>
                          <div className={styles.storageIndicators}>
                            <span className={styles.storageLocal} title="Stored locally">
                              💾 Local
                            </span>
                            {backup.in_minio && (
                              <span className={styles.storageMinio} title="Stored in MinIO">
                                ☁️ MinIO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={styles.actions}>
                          <button
                            onClick={() => handleRestore(backup.name, true)}
                            disabled={isRestoringToTemp || !!restoringTempKey}
                            className={styles.restoreToTempButton}
                            title="Restore to temporary schema for validation (safe)"
                          >
                            {isRestoringToTemp ? 'Restoring...' : '🔁 Restore to Temp'}
                          </button>
                          <button
                            onClick={() => handleRestore(backup.name, false)}
                            disabled={isRestoring || !!restoringKey}
                            className={styles.restoreButton}
                            title="Restore directly to production (REPLACES LIVE DATA!)"
                          >
                            {isRestoring ? 'Restoring...' : '⚠️ Restore to Live'}
                          </button>
                          {!backup.in_minio && (
                            <button onClick={() => handleUploadToMinio(backup.name)} disabled={isUploading || !!uploadingKey} className={styles.uploadButton}>
                              {isUploading ? 'Uploading...' : '☁️ Upload to MinIO'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBackup(backup.name)}
                            disabled={isDeleting || !!deletingKey}
                            className={styles.deleteButton}
                            title="Delete backup file (and MinIO object if present)"
                          >
                            {isDeleting ? 'Deleting...' : '🗑️ Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
