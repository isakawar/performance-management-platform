'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setAccessToken } from '@/lib/auth-storage';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [idToken, setIdToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);

  async function loginWithIdToken(token: string): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ accessToken: string }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken: token }),
      });
      setAccessToken(result.accessToken);
      router.push('/reviews');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!gsiReady || !clientId || !buttonRef.current || !window.google) {
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        void loginWithIdToken(response.credential);
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiReady]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await loginWithIdToken(idToken);
  }

  return (
    <main className="mx-auto mt-16 max-w-md p-8">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGsiReady(true)}
      />
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in with a <code>@racoongang.com</code> Google account. Verified for real by the Auth
        Service — nothing here is mocked.
      </p>

      <div ref={buttonRef} className="mt-6" />
      {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <p className="mt-2 text-xs text-amber-600">
          NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured — the Google button is unavailable.
        </p>
      )}

      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-slate-500">
          Or paste a Google ID token manually
        </summary>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <textarea
            className="h-32 rounded border border-slate-300 p-2 font-mono text-xs"
            value={idToken}
            onChange={(event) => setIdToken(event.target.value)}
            placeholder="Google ID token"
          />
          <button
            type="submit"
            disabled={submitting || idToken.length === 0}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </details>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
