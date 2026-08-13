'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { NavBar } from '@/components/nav-bar';

interface AssessmentSummary {
  id: string;
  type: 'SELF' | 'LEAD';
  status: 'DRAFT' | 'SUBMITTED';
}
interface ComparisonEntry {
  competencyId: string;
  selfGrade: string;
  leadGrade: string;
}
interface ReviewDetail {
  id: string;
  employeeEmail: string;
  leadEmail: string;
  assessments: AssessmentSummary[];
  comparison?: ComparisonEntry[];
}

export default function ReviewDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const [review, setReview] = useState<ReviewDetail | null>(null);

  useEffect(() => {
    apiFetch<ReviewDetail>(`/assessment/reviews/${params.id}`).then(setReview);
  }, [params.id]);

  if (!review) {
    return (
      <>
        <NavBar />
        <main className="p-8">Loading…</main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">
          {review.employeeEmail} ← {review.leadEmail}
        </h1>

        <ul className="mt-4 flex flex-col gap-2">
          {review.assessments.map((assessment) => (
            <li key={assessment.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <span>
                {assessment.type} — {assessment.status}
              </span>
              <Link href={`/assessments/${assessment.id}`} className="text-blue-700 underline">
                Open
              </Link>
            </li>
          ))}
        </ul>

        {review.comparison && (
          <section className="mt-8">
            <h2 className="text-lg font-medium">Self vs Lead</h2>
            <table className="mt-2 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-1">Competency</th>
                  <th className="py-1">Self</th>
                  <th className="py-1">Lead</th>
                </tr>
              </thead>
              <tbody>
                {review.comparison.map((entry) => (
                  <tr key={entry.competencyId} className="border-b border-slate-100">
                    <td className="py-1">{entry.competencyId}</td>
                    <td className="py-1">{entry.selfGrade}</td>
                    <td className="py-1">{entry.leadGrade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </>
  );
}
