import { useState } from 'react';
import styles from '../../styles/DataTransfer.module.css';

interface DataTransferProps {
  universityId: number;
  universityName: string;
  hasTempSchema: boolean;
  onTransferComplete?: () => void;
}

interface EntityCounts {
  [key: string]: number;
}

const ENTITY_TYPES = [
  { key: 'faculties', label: 'Faculties', icon: '🏛️' },
  { key: 'faculty_professors', label: 'Faculty Professors', icon: '👨‍🏫' },
  { key: 'faculty_students', label: 'Faculty Students', icon: '👨‍🎓' },
  { key: 'subjects', label: 'Subjects', icon: '📚' },
  { key: 'subject_professors', label: 'Subject Professors', icon: '👨‍🏫' },
  { key: 'lectures', label: 'Lectures', icon: '📖' },
  { key: 'lecture_materials', label: 'Lecture Materials', icon: '📄' },
];

export default function DataTransferPanel({ universityId, universityName, hasTempSchema, onTransferComplete }: DataTransferProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [productionCounts, setProductionCounts] = useState<EntityCounts>({});
  const [tempCounts, setTempCounts] = useState<EntityCounts>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [exportedData, setExportedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedByEntity, setSelectedByEntity] = useState<Record<string, 'replace' | 'merge' | 'skip_existing'>>({});

  const getStrategy = (entityKey: string): 'replace' | 'merge' | 'skip_existing' => {
    return selectedByEntity[entityKey] ?? 'merge';
  };

  const getBackendUrl = () => 'http://localhost:8000';

  const loadEntityCounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      
      // Load production counts
      const prodResponse = await fetch(
        `${getBackendUrl()}/api/v1/data-transfer/${universityId}/entities?from_temp=false`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (prodResponse.ok) {
        const prodData = await prodResponse.json();
        setProductionCounts(prodData.entities);
      }

      // Load temp counts if temp schema exists
      if (hasTempSchema) {
        const tempResponse = await fetch(
          `${getBackendUrl()}/api/v1/data-transfer/${universityId}/entities?from_temp=true`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (tempResponse.ok) {
          const tempData = await tempResponse.json();
          setTempCounts(tempData.entities);
        }
      }
    } catch (err) {
      setError('Failed to load entity counts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (entityType: string, fromTemp: boolean) => {
    const key = `${entityType}-${fromTemp ? 'temp' : 'prod'}`;
    setExporting(key);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/v1/data-transfer/${universityId}/export`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_type: entityType,
            from_temp: fromTemp,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Export failed');
      }

      const data = await response.json();
      setExportedData(data);
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${universityName}_${entityType}_${fromTemp ? 'temp' : 'prod'}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`✅ Exported ${data.count} ${entityType} records`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed';
      setError(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async (entityType: string, toTemp: boolean, strategy: 'replace' | 'merge' | 'skip_existing') => {
    if (!exportedData || exportedData.entity_type !== entityType) {
      alert('Please export data first or ensure exported data matches the entity type');
      return;
    }

    const strategyText =
      strategy === 'replace'
        ? 'Replace: throw away matching items and load exactly what is in the file.'
        : strategy === 'merge'
        ? 'Merge: keep what you already have, update matches, and add anything missing.'
        : 'Skip existing: only add new items; do not change anything that already exists.';

    const destText = toTemp
      ? 'Temporary area (safe copy — does not change your live data)'
      : 'Production (live data will be updated based on the strategy)';

    if (!confirm(`Import ${exportedData.count} ${entityType} records to ${destText}?\n\n${strategyText}\n\nDo you want to continue?`)) {
      return;
    }

    const key = `${entityType}-${toTemp ? 'temp' : 'prod'}`;
    setImporting(key);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/v1/data-transfer/${universityId}/import`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_type: entityType,
            data: exportedData.data,
            strategy: strategy,
            to_temp: toTemp,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Import failed');
      }

      const result = await response.json();
      alert(`✅ Import completed!\n\nImported: ${result.imported}\nUpdated: ${result.updated}\nSkipped: ${result.skipped}\nErrors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
      }

      // Refresh counts
      loadEntityCounts();
      if (onTransferComplete) onTransferComplete();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      setError(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setImporting(null);
    }
  };

  const handleTogglePanel = () => {
    if (!showPanel) {
      loadEntityCounts();
    }
    setShowPanel(!showPanel);
  };

  if (!hasTempSchema) {
    return null; // Only show when temp schema exists
  }

  return (
    <div className={styles.container}>
      <button onClick={handleTogglePanel} className={styles.toggleButton}>
        {showPanel ? '▼' : '▶'} 🔄 Data Transfer (Temp ↔ Production)
      </button>

      {showPanel && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3>🔄 Selective Data Transfer</h3>
            <p>Export data from temp schema and import to production (or vice versa)</p>
          </div>

          <div className={styles.helpBox}>
            <strong>Plain-language guide</strong>
            <ul className={styles.helpList}>
              <li><b>Temporary area</b>: a safe copy for testing. Changes here don’t affect your live data until you choose to promote.</li>
              <li><b>Replace</b>: throw away matching items in the destination and load exactly what’s in the file.</li>
              <li><b>Merge</b>: keep what you already have, update matching items, and add anything missing.</li>
              <li><b>Skip existing</b>: only add new items; leave anything that’s already there unchanged.</li>
            </ul>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {loading ? (
            <p>Loading entity counts...</p>
          ) : (
            <div className={styles.entitiesTable}>
              <table>
                <thead>
                  <tr>
                    <th>Entity Type</th>
                    <th>Production Count</th>
                    <th>Temp Count</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ENTITY_TYPES.map((entity) => {
                    const prodCount = productionCounts[entity.key] || 0;
                    const tempCount = tempCounts[entity.key] || 0;
                    const exportingTemp = exporting === `${entity.key}-temp`;
                    const exportingProd = exporting === `${entity.key}-prod`;
                    const importingTemp = importing === `${entity.key}-temp`;
                    const importingProd = importing === `${entity.key}-prod`;

                    return (
                      <tr key={entity.key}>
                        <td>
                          <span className={styles.entityIcon}>{entity.icon}</span>
                          {entity.label}
                        </td>
                        <td className={styles.count}>{prodCount}</td>
                        <td className={styles.count}>{tempCount}</td>
                        <td className={styles.actions}>
                          <div className={styles.actionGroup}>
                            <span className={styles.actionLabel}>Strategy:</span>
                            <select
                              value={getStrategy(entity.key)}
                              onChange={(e) =>
                                setSelectedByEntity((prev) => ({
                                  ...prev,
                                  [entity.key]: e.target.value as 'replace' | 'merge' | 'skip_existing',
                                }))
                              }
                              style={{ padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid #cfd8ff' }}
                              title="Choose how imports handle existing items for this entity"
                            >
                              <option value="merge">Merge (recommended)</option>
                              <option value="replace">Replace</option>
                              <option value="skip_existing">Skip existing</option>
                            </select>
                          </div>
                          <div className={styles.actionGroup}>
                            <span className={styles.actionLabel}>From Temp:</span>
                            <button
                              onClick={() => handleExport(entity.key, true)}
                              disabled={tempCount === 0 || !!exporting}
                              className={styles.exportButton}
                              title="Export from the temporary (safe copy) area"
                            >
                              {exportingTemp ? '⏳' : '📤'} Export
                            </button>
                            <button
                              onClick={() => handleImport(entity.key, false, getStrategy(entity.key))}
                              disabled={!exportedData || exportedData.entity_type !== entity.key || !!importing}
                              className={styles.importButton}
                              title={`Import to production — Using strategy: ${getStrategy(entity.key) === 'replace' ? 'Replace' : getStrategy(entity.key) === 'merge' ? 'Merge' : 'Skip existing'}`}
                            >
                              {importingProd ? '⏳' : '📥'} → Prod
                            </button>
                          </div>
                          <div className={styles.actionGroup}>
                            <span className={styles.actionLabel}>From Prod:</span>
                            <button
                              onClick={() => handleExport(entity.key, false)}
                              disabled={prodCount === 0 || !!exporting}
                              className={styles.exportButton}
                              title="Export from production schema"
                            >
                              {exportingProd ? '⏳' : '📤'} Export
                            </button>
                            <button
                              onClick={() => handleImport(entity.key, true, getStrategy(entity.key))}
                              disabled={!exportedData || exportedData.entity_type !== entity.key || !!importing}
                              className={styles.importButton}
                              title={`Import to temporary area — Using strategy: ${getStrategy(entity.key) === 'replace' ? 'Replace' : getStrategy(entity.key) === 'merge' ? 'Merge' : 'Skip existing'}`}
                            >
                              {importingTemp ? '⏳' : '📥'} → Temp
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {exportedData && (
            <div className={styles.exportedInfo}>
              <strong>📋 Exported Data Ready:</strong> {exportedData.count} {exportedData.entity_type} records from {exportedData.source_schema}
              <button onClick={() => setExportedData(null)} className={styles.clearButton}>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
