// Simple navigation indirection to make redirects testable
// In production this still performs a full page navigation.
export function navigate(url: string) {
  if (typeof window !== 'undefined' && window.location) {
    // Use href assignment to preserve original behavior (full reload)
    window.location.href = url;
  }
}
