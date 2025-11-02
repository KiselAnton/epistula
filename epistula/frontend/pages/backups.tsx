import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '../components/layout/MainLayout';
import DataTransferPanel from '../components/backup/DataTransferPanel';
import styles from '../styles/Backups.module.css';

interface BackupInfo {
  name: string;
  size_bytes: number;
  created_at: string;
  in_minio: boolean;
  university_id: number;
  university_name: string;
}

interface UniversityBackups {
  university_id: number;
  university_name: string;
  backups: BackupInfo[];
}

interface AllBackupsResponse {
  universities: UniversityBackups[];
  total_backup_count: number;
}

export default function Backups() {
  const router = useRouter();
  const [backupsData, setBackupsData] = useState<AllBackupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoringToTemp, setRestoringToTemp] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<number | null>(null);
  const [deletingTemp, setDeletingTemp] = useState<number | null>(null);
  const [deletingBackup, setDeletingBackup] = useState<string | null>(null);
  const [tempStatus, setTempStatus] = useState<Record<number, any>>({});

  // Helper function for consistent logging
  const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const prefix = `[Backups ${timestamp}]`;
    
    if (data) {
      console[level](`${prefix} ${message}`, data);
    } else {
      console[level](`${prefix} ${message}`);
    }
  };

  const fetchBackups = useCallback(async () => {
    log('info', 'Fetching all backups...');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        log('warn', 'No authentication token found');
        router.push('/');
        return;
      }

      log('info', 'Making API request to /api/v1/backups/all');
      const response = await fetch('http://localhost:8000/api/v1/backups/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      log('info', `API response status: ${response.status}`);

      if (!response.ok) {
        if (response.status === 403) {
          log('warn', 'Access denied (403) - User not authorized as root');
          router.push('/dashboard');
          return;
        }
        throw new Error(`Failed to fetch backups (HTTP ${response.status})`);
      }

      const data: AllBackupsResponse = await response.json();
      log('info', `Fetched ${data.total_backup_count} backups across ${data.universities.length} universities`, {
        universities: data.universities.map(u => ({ id: u.university_id, name: u.university_name, count: u.backups.length }))
      });
      setBackupsData(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load backups';
      log('error', `Error fetching backups: ${errorMsg}`, err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []); // Remove router from dependencies

  useEffect(() => {
    log('info', '🔄 Backups page mounted, fetching data...');
    fetchBackups();
    
    // Also check temp status for all universities after initial load
    if (backupsData?.universities) {
      backupsData.universities.forEach(uni => {
        checkTempStatus(uni.university_id);
      });
    }
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const handleRestore = async (universityId: number, backupName: string, universityName: string, toTemp: boolean = false) => {
    const restoreType = toTemp ? 'temporary validation schema' : 'PRODUCTION (LIVE DATA WILL BE REPLACED)';
    log('info', `Restore initiated for university ${universityId} (${universityName}) from backup: ${backupName}, to_temp=${toTemp}`);
    
    if (!confirm(`Are you sure you want to restore "${universityName}" from backup "${backupName}" to ${restoreType}?\n\n${
      toTemp 
        ? 'This will create a temporary schema for validation. Your production data will NOT be affected.'
        : 'WARNING: This will:\n1. Create a pre-restore snapshot\n2. Drop and recreate the PRODUCTION schema\n3. Restore from the selected backup\n\nYour current LIVE data will be REPLACED!\n\nConsider using "Restore to Temp" first to validate the backup.'
    }\n\n${toTemp ? 'Continue with temporary restore?' : 'Continue with PRODUCTION restore?'}`)) {
      log('info', 'Restore cancelled by user');
      return;
    }

    const restoreKey = `${universityId}-${backupName}`;
    if (toTemp) {
      setRestoringToTemp(restoreKey);
    } else {
      setRestoring(restoreKey);
    }
    setError(null);
    
    log('info', `Starting ${toTemp ? 'temp' : 'production'} restore: ${restoreKey}`);

    try {
      const token = localStorage.getItem('token');
      const url = `http://localhost:8000/api/v1/backups/${universityId}/${backupName}/restore?to_temp=${toTemp}`;
      
      log('info', `Making restore API request: POST ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      log('info', `Restore API response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        log('error', 'Restore failed', { status: response.status, error: errorData });
        throw new Error(errorData.detail || 'Restore failed');
      }

      const result = await response.json();
      log('info', `✓ Restore completed successfully to ${result.schema_name}`, result);
      
      if (toTemp) {
        alert(`✅ Successfully restored ${universityName} to temporary schema!\n\nYou can now:\n1. Validate the data in the temp schema\n2. Promote it to production if everything looks good\n3. Or discard it if it's not what you need`);
      } else {
        alert(`✅ Successfully restored ${universityName} from ${backupName} to PRODUCTION`);
      }
      
      log('info', 'Refreshing backup list and temp status after successful restore');
      fetchBackups();
      if (toTemp) {
        checkTempStatus(universityId);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Restore failed';
      log('error', `✗ Restore failed: ${errorMsg}`, err);
      setError(errorMsg);
    } finally {
      if (toTemp) {
        setRestoringToTemp(null);
      } else {
        setRestoring(null);
      }
      log('info', `Restore operation ended for ${restoreKey}`);
    }
  };

  const handleUploadToMinio = async (universityId: number, backupName: string) => {
    log('info', `Upload to MinIO initiated for backup: ${backupName} (university ${universityId})`);
    
    const uploadKey = `${universityId}-${backupName}`;
    setUploading(uploadKey);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const url = `http://localhost:8000/api/v1/backups/${universityId}/${backupName}/upload-to-minio`;
      
      log('info', `Making upload API request: POST ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      log('info', `Upload API response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        log('error', 'Upload to MinIO failed', { status: response.status, error: errorData });
        throw new Error(errorData.detail || 'Upload failed');
      }

      log('info', `✓ Successfully uploaded ${backupName} to MinIO`);
      alert(`Successfully uploaded ${backupName} to MinIO`);
      
      log('info', 'Refreshing backup list to show updated MinIO status');
      fetchBackups(); // Refresh to show updated in_minio status
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload to MinIO failed';
      log('error', `✗ Upload to MinIO failed: ${errorMsg}`, err);
      setError(errorMsg);
    } finally {
      setUploading(null);
      log('info', `Upload operation ended for ${uploadKey}`);
    }
  };

  const handleCreateBackup = async (universityId: number, universityName: string) => {
    log('info', `Create backup initiated for university ${universityId} (${universityName})`);
    
    if (!confirm(`Create a new backup for "${universityName}" now?`)) {
      log('info', 'Backup creation cancelled by user');
      return;
    }

    setCreatingBackup(universityId);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const url = `http://localhost:8000/api/v1/backups/${universityId}/create`;
      
      log('info', `Making create backup API request: POST ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      log('info', `Create backup API response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        log('error', 'Backup creation failed', { status: response.status, error: errorData });
        throw new Error(errorData.detail || 'Backup creation failed');
      }

      const result = await response.json();
      log('info', '✓ Backup created successfully', result);
      
      alert(`✅ Backup created successfully!\n\nFile: ${result.filename}\nSize: ${formatBytes(result.size_bytes)}`);
      
      log('info', 'Refreshing backup list after successful creation');
      fetchBackups(); // Refresh the list
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Backup creation failed';
      log('error', `✗ Backup creation failed: ${errorMsg}`, err);
      setError(errorMsg);
    } finally {
      setCreatingBackup(null);
      log('info', `Backup creation operation ended for university ${universityId}`);
    }
  };

  const checkTempStatus = async (universityId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/v1/backups/${universityId}/temp-status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTempStatus(prev => ({ ...prev, [universityId]: data }));
      }
    } catch (err) {
      log('error', `Failed to check temp status for university ${universityId}`, err);
    }
  };

  const handlePromoteTemp = async (universityId: number, universityName: string) => {
    if (!confirm(`⚠️ PROMOTE TO PRODUCTION\n\nThis will:\n1. Create a safety backup of current production\n2. Replace production with the temporary schema\n3. The current production data will be backed up and replaced\n\nPromote "${universityName}" temporary schema to production?`)) {
      return;
    }

    setPromoting(universityId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/v1/backups/${universityId}/promote-temp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Promotion failed');
      }

      alert(`✅ Successfully promoted temporary schema to production for ${universityName}!`);
      fetchBackups();
      checkTempStatus(universityId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Promotion failed';
      setError(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setPromoting(null);
    }
  };

  const handleDeleteTemp = async (universityId: number, universityName: string) => {
    if (!confirm(`Delete the temporary schema for "${universityName}"?\n\nThis will permanently remove the temporary restore. The production data will remain unchanged.`)) {
      return;
    }

    setDeletingTemp(universityId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/v1/backups/${universityId}/temp-schema`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Deletion failed');
      }

      alert(`✅ Temporary schema deleted for ${universityName}`);
      checkTempStatus(universityId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deletion failed';
      setError(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setDeletingTemp(null);
    }
  };

  const handleDeleteBackup = async (universityId: number, backupName: string, universityName: string) => {
    if (!confirm(`Delete backup "${backupName}" for "${universityName}"?\n\nYou can re-create a new backup later if needed.`)) {
      return;
    }

    const deleteKey = `${universityId}-${backupName}`;
    setDeletingBackup(deleteKey);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const url = `http://localhost:8000/api/v1/backups/${universityId}/${backupName}?delete_from_minio=true`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Deletion failed');
      }

      const result = await response.json();
      const minioMsg = result.deleted_minio ? ' and MinIO' : '';
      alert(`✅ Deleted ${backupName} from local${minioMsg}.`);
      fetchBackups();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deletion failed';
      setError(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setDeletingBackup(null);
    }
  };

  if (loading) {
    return (
      <MainLayout breadcrumbs={['Backups']}>
        <Head>
          <title>Backup Management - Epistula</title>
        </Head>
        <div className={styles.container}>
          <p>Loading backups...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout breadcrumbs={['Backups']}>
      <Head>
        <title>Backup Management - Epistula</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Backup Management</h1>
          <p className={styles.subtitle}>
            Total backups: {backupsData?.total_backup_count || 0} across {backupsData?.universities.length || 0} universities
          </p>
        </div>

        {error && (
          <div className={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {backupsData?.universities && backupsData.universities.length === 0 && (
          <div className={styles.empty}>
            <p>No backups found. Backups are created automatically daily for each university.</p>
          </div>
        )}

        {backupsData?.universities.map((uni) => {
          const uniTempStatus = tempStatus[uni.university_id];
          const hasTemp = uniTempStatus?.has_temp_schema || false;
          
          return (
          <div key={uni.university_id} className={styles.universitySection}>
            <div className={styles.universityHeader}>
              <h2 className={styles.universityName}>
                {uni.university_name}
                <span className={styles.backupCount}>({uni.backups.length} backups)</span>
                {hasTemp && (
                  <span className={styles.tempBadge} title="Has temporary restore ready for validation">
                    🔍 Temp Schema Active
                  </span>
                )}
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {hasTemp && (
                  <>
                    <button
                      onClick={() => handlePromoteTemp(uni.university_id, uni.university_name)}
                      disabled={promoting === uni.university_id}
                      className={styles.promoteButton}
                      title="Promote temporary schema to production"
                    >
                      {promoting === uni.university_id ? '⏳ Promoting...' : '✅ Promote to Live'}
                    </button>
                    <button
                      onClick={() => handleDeleteTemp(uni.university_id, uni.university_name)}
                      disabled={deletingTemp === uni.university_id}
                      className={styles.deleteButton}
                      title="Delete temporary schema"
                    >
                      {deletingTemp === uni.university_id ? '⏳ Deleting...' : '🗑️ Discard Temp'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleCreateBackup(uni.university_id, uni.university_name)}
                  disabled={creatingBackup === uni.university_id}
                  className={styles.backupNowButton}
                  title="Create a new backup immediately"
                >
                  {creatingBackup === uni.university_id ? '⏳ Creating...' : '💾 Backup Now'}
                </button>
              </div>
            </div>

            {hasTemp && uniTempStatus?.temp_info && (
              <div className={styles.tempInfo}>
                <strong>📋 Temporary Schema Info:</strong> 
                {' '}Faculties: {uniTempStatus.temp_info.faculty_count || 0}
                {', '}Users: {uniTempStatus.temp_info.user_count || 0}
                {' '}(Ready for validation)
              </div>
            )}

            {/* Data Transfer Panel - Only shown when temp schema exists */}
            {hasTemp && (
              <DataTransferPanel
                universityId={uni.university_id}
                universityName={uni.university_name}
                hasTempSchema={hasTemp}
                onTransferComplete={() => {
                  fetchBackups();
                  checkTempStatus(uni.university_id);
                }}
              />
            )}

            <div className={styles.backupsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Backup Name</th>
                    <th>Created</th>
                    <th>Size</th>
                    <th>Storage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uni.backups.map((backup) => {
                    const restoreKey = `${uni.university_id}-${backup.name}`;
                    const uploadKey = `${uni.university_id}-${backup.name}`;
                    const isRestoring = restoring === restoreKey;
                    const isRestoringToTemp = restoringToTemp === restoreKey;
                    const isUploading = uploading === uploadKey;

                    return (
                      <tr key={backup.name}>
                        <td className={styles.backupName}>{backup.name}</td>
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
                            onClick={() => handleRestore(uni.university_id, backup.name, uni.university_name, true)}
                            disabled={isRestoringToTemp || !!restoringToTemp}
                            className={styles.restoreToTempButton}
                            title="Restore to temporary schema for validation (safe)"
                          >
                            {isRestoringToTemp ? 'Restoring...' : '� Restore to Temp'}
                          </button>
                          <button
                            onClick={() => handleRestore(uni.university_id, backup.name, uni.university_name, false)}
                            disabled={isRestoring || !!restoring}
                            className={styles.restoreButton}
                            title="Restore directly to production (REPLACES LIVE DATA!)"
                          >
                            {isRestoring ? 'Restoring...' : '⚠️ Restore to Live'}
                          </button>
                          {!backup.in_minio && (
                            <button
                              onClick={() => handleUploadToMinio(uni.university_id, backup.name)}
                              disabled={isUploading || !!uploading}
                              className={styles.uploadButton}
                            >
                              {isUploading ? 'Uploading...' : '☁️ Upload to MinIO'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBackup(uni.university_id, backup.name, uni.university_name)}
                            disabled={deletingBackup === `${uni.university_id}-${backup.name}` || !!deletingBackup}
                            className={styles.deleteButton}
                            title="Delete backup file (and MinIO object if present)"
                          >
                            {deletingBackup === `${uni.university_id}-${backup.name}` ? 'Deleting...' : '🗑️ Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )})}
      </div>
    </MainLayout>
  );
}
