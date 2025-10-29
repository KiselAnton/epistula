import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

export default function Dashboard() {
  const [name, setName] = useState<string>('');

  // Stable logout function reference to satisfy hooks dependency rules
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }, []);

  useEffect(() => {
    try {
      const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (userRaw) {
        const user = JSON.parse(userRaw);
        setName(user?.name || user?.email || 'user');
      } else {
        // If no user, go back to login
        window.location.href = '/';
      }
    } catch (e) {
      window.location.href = '/';
    }
  }, []);

  // Sync login state across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // If token is added in another tab, reload this page
      if (e.key === 'token' && e.newValue) {
        window.location.reload();
      }
      // If token is removed in another tab, logout
      if (e.key === 'token' && !e.newValue) {
        window.location.href = '/';
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Auto-logout after 1 hour of inactivity
  useEffect(() => {
  let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      // Clear existing timer
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      // Set new timer for 1 hour
      inactivityTimer = setTimeout(() => {
        console.log('[Auto-Logout] Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    // Activity events to track
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Set up event listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, resetTimer, true);
    });

    // Start the initial timer
    resetTimer();

    // Cleanup on unmount
    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  }, [logout]);

  return (
    <>
      <Head>
        <title>Epistula - Dashboard</title>
      </Head>
      <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, Arial' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Hello, {name}</h1>
          <p>You are now logged in.</p>
          <button onClick={logout} style={{ marginTop: 16, padding: '8px 16px' }}>Log out</button>
        </div>
      </main>
    </>
  );
}
