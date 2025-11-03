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
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import '../styles/globals.css';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/react/style.css';
import '@uiw/react-markdown-preview/markdown.css';
import { SkeletonStyles } from '../components/Skeleton';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Prefetch important routes on mount
  useEffect(() => {
    // Prefetch dashboard for faster navigation
    router.prefetch('/dashboard');
  }, [router]);

  return (
    <>
      <Head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        {/* Explicit SVG favicon path to bypass any proxy caches */}
        <link rel="icon" type="image/svg+xml" href="/api/favicon" />
        {/* Apple touch icon fallback */}
        <link rel="apple-touch-icon" href="/icon-192.svg" />
        
        {/* Viewport meta tag for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        
        {/* Theme color */}
        <meta name="theme-color" content="#007bff" />
        
        {/* Performance hints */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
      </Head>
      
      {/* Global skeleton animation styles */}
      <SkeletonStyles />
      
      <Component {...pageProps} />
    </>
  );
}
