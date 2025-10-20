/**
 * Main application component for Epistula ISO.
 *
 * This component serves as the root of the Next.js application,
 * wrapping all pages and applying global styles.
 *
 * @param {AppProps} props - Next.js application props.
 * @param {React.ComponentType} props.Component - The active page component.
 * @param {object} props.pageProps - Props passed to the page component.
 * @returns {JSX.Element} The rendered application.
 */

import type { AppProps } from 'next/app';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
