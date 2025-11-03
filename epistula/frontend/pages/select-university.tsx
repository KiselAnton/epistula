/**
 * University Selector page for users with access to multiple universities.
 * 
 * This page is displayed after login when a user has roles in multiple universities.
 * It allows the user to choose which university context to work in.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/UniversitySelector.module.css';
import { getBackendUrl } from '../lib/config';

interface UniversityAccess {
  university_id: number;
  university_name: string;
  university_code: string;
  role: string;
  is_active: boolean;
  logo_url?: string;
}

export default function SelectUniversity() {
  const router = useRouter();
  const [universities, setUniversities] = useState<UniversityAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      router.push('/');
      return;
    }

    try {
      const userData = JSON.parse(userStr);
      const universityAccess = userData.university_access || [];

      setUserName(userData.name || userData.email);

      if (universityAccess.length === 0) {
        // No university access, check if root
        if (userData.role === 'root') {
          router.push('/dashboard');
        } else {
          // No access anywhere - show error and logout
          alert('You do not have access to any universities. Please contact your administrator.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/');
        }
        return;
      }

      if (universityAccess.length === 1) {
        // Only one university, redirect directly
        localStorage.setItem('selected_university_id', String(universityAccess[0].university_id));
        router.push(`/university/${universityAccess[0].university_id}`);
        return;
      }

      // Multiple universities - show selector
      setUniversities(universityAccess);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleSelectUniversity = (universityId: number) => {
    // Store selected university for quick access
    localStorage.setItem('selected_university_id', String(universityId));
    router.push(`/university/${universityId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selected_university_id');
    router.push('/');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <p>Loading your universities...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Select University - Epistula</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1>Welcome, {userName}!</h1>
            <p className={styles.subtitle}>
              You have access to {universities.length} {universities.length === 1 ? 'university' : 'universities'}. 
              Please select one to continue:
            </p>
          </div>
          
          <div className={styles.universityList}>
            {universities.map((uni) => (
              <button
                key={uni.university_id}
                className={styles.universityCard}
                onClick={() => handleSelectUniversity(uni.university_id)}
                title={`Access ${uni.university_name} as ${uni.role}`}
              >
                <div className={styles.logoContainer}>
                  {uni.logo_url ? (
                    <Image
                      src={`${getBackendUrl()}${uni.logo_url}`}
                      alt={uni.university_name}
                      width={80}
                      height={80}
                      style={{ objectFit: 'cover', borderRadius: '8px' }}
                    />
                  ) : (
                    <div className={styles.logoPlaceholder}>
                      🎓
                    </div>
                  )}
                </div>
                <div className={styles.universityInfo}>
                  <div className={styles.universityHeader}>
                    <h2>{uni.university_name}</h2>
                    <span className={`${styles.badge} ${styles[`badge-${uni.role}`]}`}>
                      {uni.role.replace('_', ' ')}
                    </span>
                  </div>
                  <p className={styles.code}>Code: {uni.university_code}</p>
                </div>
              </button>
            ))}
          </div>

          <div className={styles.footer}>
            <button 
              onClick={handleLogout}
              className={styles.logoutButton}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
