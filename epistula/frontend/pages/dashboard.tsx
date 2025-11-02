import Head from 'next/head';
import { useEffect, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  return (
    <>
      <Head>
        <title>Epistula -- Dashboard</title>
      </Head>
      <MainLayout breadcrumbs={['Dashboard']}>
        <div style={{ padding: '2rem' }}>
          <h1>Welcome to Epistula</h1>
          {user && (
            <p>Logged in as: <strong>{user.name}</strong> ({user.email})</p>
          )}
        </div>
      </MainLayout>
    </>
  );
}
