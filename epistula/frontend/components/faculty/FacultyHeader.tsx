import { Faculty } from '../../types';
import { getBackendUrl } from '../../lib/config';
import Image from 'next/image';

interface FacultyHeaderProps {
  faculty: Faculty;
  universityId: string;
  onLogoUpdate?: (updatedFaculty: Faculty) => void;
}


export default function FacultyHeader({ faculty, universityId: _universityId, onLogoUpdate: _onLogoUpdate }: FacultyHeaderProps) {
  // Editing moved into the unified wizard; this header is now display-only.

  return (
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
        {faculty.logo_url ? (
          <Image
            src={`${getBackendUrl()}${faculty.logo_url}`}
            alt={faculty.name}
            width={120}
            height={120}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: '3rem' }}>🎓</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.5rem'
        }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{faculty.name}</h1>
          <span style={{
            background: faculty.is_active ? '#28a745' : '#dc3545',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {faculty.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div style={{
          display: 'flex',
          gap: '1rem',
          color: '#666',
          fontSize: '0.95rem'
        }}>
          <span><strong>Code:</strong> {faculty.code}</span>
          <span><strong>Short Name:</strong> {faculty.short_name}</span>
        </div>
      </div>
    </div>
  );
}
