import { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmModal from '../common/ConfirmModal';
import DataTransferPanel from './DataTransferPanel';
import styles from '../../styles/Backups.module.css';
import backupStyles from './UniversityBackupSection.module.css';
import btn from '../../styles/Buttons.module.css';
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deletingAll, setDeletingAll] = useState<boolean>(false);
  const [deletingBulk, setDeletingBulk] = useState<boolean>(false);
  const [editingMeta, setEditingMeta] = useState<Record<string, { title: string; description: string; saving: boolean }>>({});

  // unified confirm modal state
  const [confirm, setConfirm] = useState<{ open: boolean; title?: string; message: string; onConfirm?: () => void }>({ open: false, message: '' });
  const openConfirm = (message: string, onConfirm: () => void, title?: string) => setConfirm({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirm({ open: false, message: '' });

  const backend = useMemo(() => getBackendUrl(), []);
  // Persist collapsed/expanded per university id
  const storageKey = useMemo(() => `ubs-collapsed:${universityId}`, [universityId]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
          setCollapsed(saved === '1');
        } else {
          // ensure state matches provided default if nothing saved yet
          setCollapsed(defaultCollapsed);
        }
      }
    } catch {}
  }, [storageKey, defaultCollapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, next ? '1' : '0');
        }
      } catch {}
      return next;
    });
  }, [storageKey]);

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
        // Surface status code to help UI show meaningful message
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
    // If we don't have initial backups, or it is an empty list, load them; always get temp status
    if (!initialBackups || (Array.isArray(initialBackups) && initialBackups.length === 0)) {
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

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/manage/delete-all?delete_from_minio=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Failed to delete all backups');
      }
      await fetchBackups();
      setSelected({});
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Failed to delete all'}`);
    } finally {
      setDeletingAll(false);
    }
  };

  const handleBulkDelete = async () => {
    const names = Object.keys(selected).filter((k) => selected[k]);
    if (names.length === 0) return;
    setDeletingBulk(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backend}/api/v1/backups/${universityId}/manage/bulk-delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: names, delete_from_minio: true }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.detail || 'Failed to delete selected');
      }
      await fetchBackups();
      setSelected({});
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Failed to delete selected'}`);
    } finally {
      setDeletingBulk(false);
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
    } catch {
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
      // Optimistically update local list to reflect new title/description immediately,
      // as the list endpoint may not include meta fields.
      setBackups((prev) =>
        prev.map((b) =>
          b.name === backupName
            ? { ...b, title: (meta.title || null), description: (meta.description || null) }
            : b
        )
      );
      cancelEditMeta(backupName);
      onChanged?.();
    } catch (e: any) {
      alert(`❌ ${e?.message || 'Failed to save'}`);
      setEditingMeta((prev) => ({ ...prev, [key]: { ...(prev[key] || { title: '', description: '', saving: false }), saving: false } }));
    }
  };

  const hasTemp = !!tempStatus?.has_temp_schema;

  return (
    <div className={styles.universitySection}>
      <ConfirmModal
        open={confirm.open}
        title={confirm.title || 'Please confirm'}
        message={confirm.message}
        onCancel={closeConfirm}
        onConfirm={() => { const fn = confirm.onConfirm; closeConfirm(); fn && fn(); }}
      />
      <div className={styles.universityHeader}>
        <div className={backupStyles.backupControls}>
          <button
            onClick={toggleCollapsed}
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
        <div className={backupStyles.backupActions}>
          {hasTemp && (
            <>
              <button onClick={() => openConfirm(`⚠️ Promote TEMP → LIVE for "${universityName}"?\n\nA safety backup will be created automatically.`, () => handlePromoteTemp(), 'Promote to Live')} disabled={promoting} className={`${btn.btn} ${btn.btnSuccess}`} title="Promote temporary schema to production">
                {promoting ? '⏳ Promoting...' : '✅ Promote to Live'}
              </button>
              <button onClick={() => openConfirm(`Delete temporary schema for "${universityName}"?`, () => handleDeleteTemp(), 'Delete Temporary Schema')} disabled={deletingTemp} className={`${btn.btn} ${btn.btnDanger}`} title="Delete temporary schema">
                {deletingTemp ? '⏳ Deleting...' : '🗑️ Discard Temp'}
              </button>
            </>
          )}
          <button onClick={() => openConfirm(`Create a new backup for "${universityName}" now?`, () => handleCreateBackup(), 'Create Backup')} disabled={creatingBackup} className={`${btn.btn} ${btn.btnOutlineLight}`} title="Create a new backup immediately">
            {creatingBackup ? '⏳ Creating...' : '💾 Backup Now'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {error && (
            <div className={backupStyles.errorMessage}>
              <div className={backupStyles.errorHeader}>
                <span>
                  {error.includes('HTTP 401') || error.toLowerCase().includes('unauthorized')
                    ? 'You are not authenticated. Please sign in again.'
                    : error.includes('HTTP 403') || error.toLowerCase().includes('permission')
                      ? 'You do not have permission to view backups for this university (root or uni_admin required).'
                      : error}
                </span>
                <button onClick={fetchBackups} className={`${btn.btn} ${btn.btnSecondary}`}>Retry</button>
              </div>
            </div>
          )}
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
              <p className={backupStyles.loadingMessage}>Loading backups…</p>
            ) : backups.length === 0 ? (
              <div className={backupStyles.emptyState}>
                <p className={backupStyles.emptyStateText}>No backups yet.</p>
                <p className={backupStyles.emptyStateTip}>Tip: Use &quot;Backup Now&quot; to create one, or check the Backups page for a global overview.</p>
              </div>
            ) : (
              <>
              <div className={backupStyles.backupList}>
                <div className={backupStyles.backupListHeader}>
                  <button onClick={fetchBackups} className={`${btn.btn} ${btn.btnSecondary}`}>Refresh</button>
                  <button onClick={() => openConfirm(`Delete ALL backups for "${universityName}"?`, () => handleDeleteAll(), 'Delete All Backups')} disabled={deletingAll || backups.length === 0} className={`${btn.btn} ${btn.btnDanger}`}>{deletingAll ? 'Deleting…' : '🗑️ Remove All'}</button>
                  <button onClick={() => { const count = Object.values(selected).filter(Boolean).length; if (count>0) openConfirm(`Delete ${count} selected backups?`, () => handleBulkDelete(), 'Delete Selected Backups'); }} disabled={deletingBulk || Object.values(selected).every((v) => !v)} className={`${btn.btn} ${btn.btnDanger}`}>{deletingBulk ? 'Deleting…' : '🗑️ Delete Selected'}</button>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={backups.length > 0 && backups.every((b) => selected[b.name])}
                        onChange={(e) => {
                          const v = e.target.checked;
                          const m: Record<string, boolean> = {};
                          backups.forEach((b) => (m[b.name] = v));
                          setSelected(m);
                        }}
                      />
                    </th>
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
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${backup.name}`}
                            checked={!!selected[backup.name]}
                            onChange={(e) => setSelected((prev) => ({ ...prev, [backup.name]: e.target.checked }))}
                          />
                        </td>
                        <td className={styles.backupName}>
                          <div className={backupStyles.backupDetails}>
                            <div className={backupStyles.backupTitle}>{backup.title?.trim() ? backup.title : '(no title)'}</div>
                            <div className={backupStyles.backupFileName} title={backup.name}>
                              {backup.name}
                            </div>
                            {editingMeta[key] ? (
                              <div className={backupStyles.backupMetadata}>
                                <input
                                  type="text"
                                  placeholder="Title"
                                  value={editingMeta[key].title}
                                  onChange={(e) =>
                                    setEditingMeta((prev) => ({ ...prev, [key]: { ...prev[key], title: e.target.value } }))
                                  }
                                  className={backupStyles.backupMetaInput}
                                />
                                <textarea
                                  placeholder="Description / notes"
                                  value={editingMeta[key].description}
                                  onChange={(e) =>
                                    setEditingMeta((prev) => ({ ...prev, [key]: { ...prev[key], description: e.target.value } }))
                                  }
                                  rows={2}
                                  className={backupStyles.backupMetaInput}
                                />
                                <div className={backupStyles.backupBulkActions}>
                                  <button onClick={() => saveMeta(backup.name)} disabled={editingMeta[key].saving} className={`${btn.btn} ${btn.btnSuccess}`}>
                                    {editingMeta[key].saving ? 'Saving...' : '💾 Save'}
                                  </button>
                                  <button onClick={() => cancelEditMeta(backup.name)} className={`${btn.btn} ${btn.btnSecondary}`}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={backupStyles.backupMetaEditActions}>
                                <button onClick={() => startEditMeta(backup)} className={`${btn.btn} ${btn.btnWarning}`}>
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
                            onClick={() => openConfirm(`Restore temporary (safe) for "${universityName}" from backup:\n${backup.name}?`, () => handleRestore(backup.name, true), 'Restore to Temp')}
                            disabled={isRestoringToTemp || !!restoringTempKey}
                            className={`${btn.btn} ${btn.btnWarning}`}
                            title="Restore to temporary schema for validation (safe)"
                          >
                            {isRestoringToTemp ? 'Restoring...' : '🔁 Restore to Temp'}
                          </button>
                          <button
                            onClick={() => openConfirm(`Restore LIVE (dangerous) for "${universityName}" from backup:\n${backup.name}?`, () => handleRestore(backup.name, false), 'Restore to Live')}
                            disabled={isRestoring || !!restoringKey}
                            className={`${btn.btn} ${btn.btnDanger}`}
                            title="Restore directly to production (REPLACES LIVE DATA!)"
                          >
                            {isRestoring ? 'Restoring...' : '⚠️ Restore to Live'}
                          </button>
                          {!backup.in_minio && (
                            <button onClick={() => handleUploadToMinio(backup.name)} disabled={isUploading || !!uploadingKey} className={`${btn.btn} ${btn.btnPrimary}`}>
                              {isUploading ? 'Uploading...' : '☁️ Upload to MinIO'}
                            </button>
                          )}
                          <button
                            onClick={() => openConfirm(`Delete backup ${backup.name}? This will remove local file and MinIO object (if any).`, () => handleDeleteBackup(backup.name), 'Delete Backup')}
                            disabled={isDeleting || !!deletingKey}
                            className={`${btn.btn} ${btn.btnDanger}`}
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
