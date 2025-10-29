import { ReactNode, useCallback, useEffect, useState } from 'react';
import styles from '../../styles/Layout.module.css';

export interface MainLayoutProps {
  children: ReactNode;
  breadcrumbs?: string[];
}

export default function MainLayout({ children, breadcrumbs = ['Dashboard'] }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

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
    } catch (_) {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }, []);

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

  return (
    <div className={styles.appShell}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarTopRow}>
          <button
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            className={styles.collapseBtn}
            onClick={() => setCollapsed((c: boolean) => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '»' : '«'}
          </button>
          {!collapsed && <span className={styles.logo}>Epistula</span>}
        </div>

        <nav className={styles.nav} aria-label="Main Navigation">
          {/* Navigation items will be added as pages are implemented */}
        </nav>

        <div className={styles.sidebarBottom}>
          {!collapsed && <button className={styles.logoutBtn} onClick={logout}>Log out</button>}
        </div>
      </aside>

      <div className={styles.mainPane}>
        <header className={styles.header}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
            <ol>
              {breadcrumbs.map((crumb, idx) => (
                <li key={`${crumb}-${idx}`}>
                  <span className={styles.crumb}>{crumb}</span>
                  {idx < breadcrumbs.length - 1 && <span className={styles.crumbSep}>/</span>}
                </li>
              ))}
            </ol>
          </nav>
        </header>
        <section className={styles.content}>
          {children}
        </section>
      </div>
    </div>
  );
}
