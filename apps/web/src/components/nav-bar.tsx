'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearAccessToken } from '@/lib/auth-storage';

export function NavBar(): JSX.Element {
  const router = useRouter();

  function handleLogout(): void {
    clearAccessToken();
    router.push('/login');
  }

  return (
    <nav className="flex items-center gap-4 border-b border-slate-200 bg-white p-4">
      <Link href="/reviews" className="font-semibold">
        PMP Assessment Demo
      </Link>
      <Link href="/builder">Builder</Link>
      <Link href="/reviews">Reviews</Link>
      <button onClick={handleLogout} className="ml-auto text-sm text-slate-500 underline">
        Log out
      </button>
    </nav>
  );
}
