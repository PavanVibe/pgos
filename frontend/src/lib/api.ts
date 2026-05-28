const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://pgos-production-d612.up.railway.app/api';
export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  let token: string | null = null;

  if (typeof window !== 'undefined') {
    // @ts-ignore
    if (window.Clerk && window.Clerk.session) {
      // @ts-ignore
      token = await window.Clerk.session.getToken();
    }
  }

  const headers = new Headers(options.headers || {});

  // Only set content type if we aren't sending FormData (e.g. file uploads)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `API Error: ${response.status}`);
  }

  return response.json();
}
