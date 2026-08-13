'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setAccessToken } from '@/lib/auth-storage';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [idToken, setIdToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ accessToken: string }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      setAccessToken(result.accessToken);
      router.push('/reviews');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-md p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        Paste a Google ID token for a <code>@racoongang.com</code> account (e.g. from{' '}
        <a className="underline" href="https://developers.google.com/oauthplayground">
          Google OAuth Playground
        </a>
        ). Verified for real by the Auth Service — nothing here is mocked.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <textarea
          className="h-32 rounded border border-slate-300 p-2 font-mono text-xs"
          value={idToken}
          onChange={(event) => setIdToken(event.target.value)}
          placeholder="Google ID token"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || idToken.length === 0}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
