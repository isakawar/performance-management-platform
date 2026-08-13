'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth-storage';

export default function HomePage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    router.replace(getAccessToken() ? '/reviews' : '/login');
  }, [router]);

  return (
    <main className="p-8">
      <p className="text-slate-500">Redirecting…</p>
    </main>
  );
}
