export function getBackendUrl(): string {
  // Prefer explicit env variable if set at build time
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl;
  }
  // Fallback: derive from browser location (client-side only)
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  // Server-side fallback for SSR during build
  return 'http://localhost:8000';
}
