import { useEffect, useState } from 'react';
import Head from 'next/head';

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

export default function Hello() {
  const [name, setName] = useState<string>('');

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

  // Auto-logout after 1 hour of inactivity
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

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
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <>
      <Head>
        <title>Hello</title>
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
