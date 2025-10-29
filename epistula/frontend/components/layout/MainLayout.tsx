import { ReactNode, useCallback, useEffect, useState } from 'react';
import styles from '../../styles/Layout.module.css';

export interface MainLayoutProps {
  children: ReactNode;
  breadcrumbs?: string[];
}

export default function MainLayout({ children, breadcrumbs = ['Dashboard'] }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [name, setName] = useState<string>('');

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

  // Load user for greeting or future use
  useEffect(() => {
    try {
      const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (userRaw) {
        const user = JSON.parse(userRaw);
        setName(user?.name || user?.email || 'user');
      } else {
        // If no user, go back to login
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    } catch (_) {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }, []);

  // Auto-logout after 1 hour inactivity (same as previous behavior)
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        console.log('[Auto-Logout] Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
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
          {/* Placeholder items; to be wired later */}
          <button className={styles.navItem} disabled={!collapsed && false}>
            {!collapsed && <span>Home</span>}
          </button>
          <button className={styles.navItem} disabled>
            {!collapsed && <span>Settings</span>}
          </button>
          <button className={styles.navItem} disabled>
            {!collapsed && <span>Reports</span>}
          </button>
        </nav>

        <div className={styles.sidebarBottom}>
          {!collapsed && <div className={styles.userBox} title={name}>Hello, {name}</div>}
          <button className={styles.logoutBtn} onClick={logout}>Log out</button>
        </div>
      </aside>

      <div className={styles.mainPane}>
        <header className={styles.header}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
            <ol>
              {breadcrumbs.map((crumb, idx) => (
                <li key={idx}>
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
