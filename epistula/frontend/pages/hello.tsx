import { useEffect, useState } from 'react';
import Head from 'next/head';

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
