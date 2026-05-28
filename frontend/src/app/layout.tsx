import { useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://pgos-production-d612.up.railway.app/api';

export async function fetchApi(endpoint: string, options: RequestInit = {}, getToken?: () => Promise<string | null>, orgId?: string | null) {
  let token: string | null = null;

  if (getToken) {
    token = await getToken();
  } else if (typeof window !== 'undefined') {
    // @ts-ignore
    if (window.Clerk?.session) {
      // @ts-ignore
      token = await window.Clerk.session.getToken();
    }
  }

  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (orgId) {
    headers.set('x-org-id', orgId);
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