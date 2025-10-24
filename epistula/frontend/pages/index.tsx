/**
 * Login page component for Epistula ISO.
 *
 * Provides user authentication interface with username/password login.
 * Handles API authentication, token storage, and redirects on success.
 *
 * @returns {JSX.Element} The login page.
 */

import { useState, FormEvent } from 'react';
import Head from 'next/head';
import styles from '../styles/Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const isValidEmail = (value: string) => {
    // Special case: allow plain "root"
    if (value.trim().toLowerCase() === 'root') return true;
    // Basic RFC-like email check
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

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
      // Client-side email validation (with root exception)
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address (or use "root").');
        setEmailTouched(true);
        setLoading(false);
        return;
      }

      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/v1/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

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
    } catch (err) {
      setError('Unable to connect to server. Please try again.');
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
                  Please enter a valid email address (or use "root").
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
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className={styles.info}>
            Tip: The special user <strong>root</strong> can type just "root" in the email field.
          </p>
        </div>
      </div>
    </>
  );
}
