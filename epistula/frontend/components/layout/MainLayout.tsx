import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../../styles/Layout.module.css';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface MainLayoutProps {
  children: ReactNode;
  breadcrumbs?: (string | Breadcrumb)[];
}

export default function MainLayout({ children, breadcrumbs = ['Dashboard'] }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hasUserPref, setHasUserPref] = useState(false);
  const [primaryUniId, setPrimaryUniId] = useState<number | null>(null);
  const [primaryUniName, setPrimaryUniName] = useState<string | null>(null);
  const [isRoot, setIsRoot] = useState(false);
  const [hasMultipleUniversities, setHasMultipleUniversities] = useState(false);
  const router = useRouter();

  // Logout clears local storage and redirects to login
  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Notify other tabs
      window.dispatchEvent(new Event('storage'));
      window.location.href = '/';
    }
  }, []);

  // Load user for authentication check
  useEffect(() => {
    try {
      const hasUser = typeof window !== 'undefined' && !!localStorage.getItem('user');
      if (!hasUser && typeof window !== 'undefined') {
        window.location.href = '/';
      }
      // Also capture user's primary university for navigation label/link
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('user');
        if (raw) {
          try {
            const u = JSON.parse(raw);
            setIsRoot(u?.role === 'root');
            const universityAccess = u?.university_access || [];
            setHasMultipleUniversities(universityAccess.length > 1);
            if (u?.primary_university_id) {
              setPrimaryUniId(Number(u.primary_university_id));
            }
          } catch {}
        }
      }
    } catch (_) {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }, []);

  // Resolve primary university name for sidebar label
  useEffect(() => {
    const fetchUni = async () => {
      // Only show university link for non-root users
      // Root users should see the "Universities" link instead
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const base = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : 'http://localhost:8000';
      
      // Check if user is root
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (raw) {
          const u = JSON.parse(raw);
          if (u?.role === 'root') {
            // Root users don't get primary university link
            return;
          }
        }
      } catch {}
      
      if (!primaryUniId) {
        try {
          if (!token) return;
          const res = await fetch(`${base}/api/v1/universities/`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) return;
          const list = await res.json();
          if (Array.isArray(list) && list.length === 1) {
            setPrimaryUniId(list[0].id);
            setPrimaryUniName(list[0].name || list[0].code);
          }
        } catch {}
        return;
      }
      try {
        if (!token) return;
        const res = await fetch(`${base}/api/v1/universities/`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const list = await res.json();
        const match = Array.isArray(list) ? list.find((x: any) => x.id === primaryUniId) : null;
        if (match) setPrimaryUniName(match.name || match.code || `University ${primaryUniId}`);
      } catch {}
    };
    fetchUni();
  }, [primaryUniId]);

  // If non-root user navigates to /universities and has a primary university, redirect them
  useEffect(() => {
    if (primaryUniId && router.pathname === '/universities') {
      // Check if user is root - only non-root users should be redirected
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (raw) {
          const u = JSON.parse(raw);
          // Only redirect if NOT root
          if (u?.role !== 'root') {
            router.replace(`/university/${primaryUniId}`);
          }
        }
      } catch {}
    }
  }, [primaryUniId, router.pathname, router]);

  // Auto-logout after 1 hour inactivity with throttled event handling
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
    const THROTTLE_INTERVAL = 5 * 1000; // Only reset timer once every 5 seconds
    let inactivityTimer: ReturnType<typeof setTimeout>;
    let lastResetTime = 0;

    const resetTimer = () => {
      const now = Date.now();
      // Throttle: only reset if enough time has passed since last reset
      if (now - lastResetTime < THROTTLE_INTERVAL) {
        return;
      }
      lastResetTime = now;
      
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        console.log('[Auto-Logout] Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    // Remove mousemove to avoid excessive firing; keeping meaningful interaction events
    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((event) => document.addEventListener(event, resetTimer, true));
    resetTimer();
    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((event) => document.removeEventListener(event, resetTimer, true));
    };
  }, [logout]);

  // Sync login state across tabs (mirror old dashboard behavior)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' && e.newValue) {
        window.location.reload();
      }
      if (e.key === 'token' && !e.newValue) {
        window.location.href = '/';
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize sidebar state: load persisted pref or infer from viewport on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const persisted = localStorage.getItem('sidebarCollapsed');
      if (persisted !== null) {
        setCollapsed(persisted === 'true');
        setHasUserPref(true);
      } else {
        const shouldCollapse = window.innerWidth < 1100; // collapse by default on smaller screens
        setCollapsed(shouldCollapse);
      }
    } catch { /* ignore */ }
  }, []);

  // If user hasn't set a preference yet, adapt to window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasUserPref) return;
    const onResize = () => {
      const shouldCollapse = window.innerWidth < 1100;
      setCollapsed(shouldCollapse);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [hasUserPref]);

  const toggleCollapsed = () => {
    setCollapsed((c: boolean) => {
      const next = !c;
      try { localStorage.setItem('sidebarCollapsed', String(next)); } catch {}
      setHasUserPref(true);
      return next;
    });
  };

  return (
    <div className={`${styles.appShell} ${collapsed ? styles.appShellCollapsed : ''}`}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarTopRow}>
          <button
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '»' : '«'}
          </button>
          {!collapsed && <span className={styles.logo}>Epistula</span>}
        </div>

        <nav className={styles.nav} aria-label="Main Navigation">
          <Link href="/dashboard" className={`${styles.navItem} ${router.pathname === '/dashboard' ? styles.navItemActive : ''}`}>
            <span className={styles.navIcon}>📊</span>
            {!collapsed && <span>Dashboard</span>}
          </Link>
          {primaryUniId ? (
            <Link href={`/university/${primaryUniId}`} className={`${styles.navItem} ${router.asPath.startsWith(`/university/${primaryUniId}`) ? styles.navItemActive : ''}`}>
              <span className={styles.navIcon}>🏛️</span>
              {!collapsed && <span>{primaryUniName || 'University'}</span>}
            </Link>
          ) : (
            <Link href="/universities" className={`${styles.navItem} ${router.pathname === '/universities' ? styles.navItemActive : ''}`}>
              <span className={styles.navIcon}>🏛️</span>
              {!collapsed && <span>Universities</span>}
            </Link>
          )}
          {primaryUniId && (
            <Link href={`/university/${primaryUniId}/my/notes`} className={`${styles.navItem} ${router.asPath.startsWith(`/university/${primaryUniId}/my/notes`) ? styles.navItemActive : ''}`}>
              <span className={styles.navIcon}>📝</span>
              {!collapsed && <span>My Notes</span>}
            </Link>
          )}
          {isRoot && (
            <Link href="/backups" className={`${styles.navItem} ${router.pathname === '/backups' ? styles.navItemActive : ''}`}>
              <span className={styles.navIcon}>💾</span>
              {!collapsed && <span>Backups</span>}
            </Link>
          )}
        </nav>

        <div className={styles.sidebarBottom}>
          {!collapsed && <button className={styles.logoutBtn} onClick={logout}>Log out</button>}
        </div>
      </aside>

      <div className={styles.mainPane}>
        <header className={styles.header}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
            <ol>
              {breadcrumbs.map((crumb, idx) => {
                const breadcrumbItem = typeof crumb === 'string' ? { label: crumb } : crumb;
                const isLast = idx === breadcrumbs.length - 1;
                
                return (
                  <li key={`${breadcrumbItem.label}-${idx}`}>
                    {breadcrumbItem.href && !isLast ? (
                      <Link href={breadcrumbItem.href} className={styles.crumb}>
                        {breadcrumbItem.label}
                      </Link>
                    ) : (
                      <span className={styles.crumb}>{breadcrumbItem.label}</span>
                    )}
                    {!isLast && <span className={styles.crumbSep}>/</span>}
                  </li>
                );
              })}
            </ol>
          </nav>
          {hasMultipleUniversities && (
            <button
              onClick={() => router.push('/select-university')}
              className={styles.switchUniversityBtn}
              title="Switch University"
            >
              🔄 Switch University
            </button>
          )}
        </header>
        <section className={styles.content}>
          {children}
        </section>
      </div>
    </div>
  );
}
