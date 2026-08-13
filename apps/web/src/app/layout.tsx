import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PMP Assessment Demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
