import Head from 'next/head';
import MainLayout from '../components/layout/MainLayout';

export default function Dashboard() {
  return (
    <>
      <Head>
        <title>Epistula - Dashboard</title>
      </Head>
      <MainLayout breadcrumbs={["Epistula", "Dashboard"]}>
        <div style={{
          border: '1px dashed rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: 24,
          minHeight: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8'
        }}>
          Main content area
        </div>
      </MainLayout>
    </>
  );
}
