/**
 * Login page component for Epistula ISO.
 *
 * Provides user authentication interface with username/password login.
 * Handles API authentication, token storage, and redirects on success.
 *
 * @returns {JSX.Element} The login page.
 */

import { useState, useEffect, FormEvent } from 'react';
import Head from 'next/head';
import styles from '../styles/Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  const isValidEmail = (value: string) => {
    // Special case: allow plain "root" for internal admin
    if (value.trim().toLowerCase() === 'root') return true;
    // Basic RFC-like email check
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

  // Check if form is valid and ready to submit
  const isFormValid = () => {
    return email.trim() !== '' && 
           password.trim() !== '' && 
           isValidEmail(email);
  };

  // Determine backend URL (browser-safe)
  const getBackendUrl = () => {
    // Prefer explicit public env, else same host on port 8000
    const configured = (process.env.NEXT_PUBLIC_BACKEND_URL as string | undefined);
    if (configured && configured.trim() !== '') return configured;
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
  };

  // Health preflight on mount to avoid slow timeouts during login
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const url = `${getBackendUrl()}/health`;
    fetch(url, { signal: controller.signal })
      .then((res) => setApiHealthy(res.ok))
      .catch(() => setApiHealthy(false))
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  /**
   * Handle login form submission.
   *
   * Sends credentials to backend API, stores auth token on success,
   * and redirects to dashboard.
   *
   * @param {FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Client-side email validation
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address.');
        setEmailTouched(true);
        setLoading(false);
        return;
      }

      const backendUrl = getBackendUrl();
      // Map the special alias 'root' to the configured root email so backend EmailStr accepts it
      const effectiveEmail = email.trim().toLowerCase() === 'root'
        ? (process.env.NEXT_PUBLIC_ROOT_EMAIL || 'root@localhost.localdomain')
        : email;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${backendUrl}/api/v1/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          email: effectiveEmail,
          password: password,
        }),
      });

      const data = await response.json();
      clearTimeout(timeout);

      if (response.ok) {
        // Store the token
        localStorage.setItem('token', data.access_token);
        // Store user for greeting page
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        // Redirect to dashboard or home page
        window.location.href = '/hello';
      } else {
        setError(data.detail || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Server took too long to respond. Please try again.');
      } else {
        setError('Unable to connect to server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Epistula - Login</title>
        <meta name="description" content="Epistula Login Page" />
      </Head>
      <div className={styles.container}>
        <div className={styles.loginBox}>
          <h1 className={styles.title}>Epistula</h1>
          <p className={styles.subtitle}>Welcome back</p>
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {apiHealthy === false && (
              <div className={styles.error}>
                The server is not reachable. Please ensure the backend is running on port 8000.
              </div>
            )}
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                type="text"
                id="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }}
                className={styles.input}
                required
                autoFocus
              />
              {emailTouched && !isValidEmail(email) && (
                <div className={styles.error}>
                  Please enter a valid email address.
                </div>
              )}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}
            <button
              type="submit"
              className={styles.button}
              disabled={loading || !isFormValid()}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
