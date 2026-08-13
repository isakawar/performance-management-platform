'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { NavBar } from '@/components/nav-bar';

interface Review {
  id: string;
  questionnaireId: string;
  employeeEmail: string;
  leadEmail: string;
  createdAt: string;
}
interface Questionnaire {
  id: string;
  name: string;
}

export default function ReviewsPage(): JSX.Element {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [form, setForm] = useState({ questionnaireId: '', employeeEmail: '', leadEmail: '' });

  async function refresh(): Promise<void> {
    setReviews(await apiFetch<Review[]>('/assessment/reviews'));
    setQuestionnaires(await apiFetch<Questionnaire[]>('/assessment/questionnaires'));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startReview(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await apiFetch('/assessment/reviews', { method: 'POST', body: JSON.stringify(form) });
    setForm({ questionnaireId: '', employeeEmail: '', leadEmail: '' });
    await refresh();
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Reviews</h1>

        <ul className="mt-4 flex flex-col gap-2">
          {reviews.map((review) => (
            <li key={review.id} className="rounded border border-slate-200 p-3">
              <Link href={`/reviews/${review.id}`} className="text-blue-700 underline">
                {review.employeeEmail} ← {review.leadEmail}
              </Link>
            </li>
          ))}
          {reviews.length === 0 && <li className="text-slate-500">No reviews yet.</li>}
        </ul>

        <form onSubmit={startReview} className="mt-8 flex flex-col gap-2 rounded border border-slate-200 p-4">
          <h2 className="font-medium">Start a review</h2>
          <select
            className="rounded border border-slate-300 p-2"
            value={form.questionnaireId}
            onChange={(event) => setForm((current) => ({ ...current, questionnaireId: event.target.value }))}
          >
            <option value="">Select questionnaire…</option>
            {questionnaires.map((questionnaire) => (
              <option key={questionnaire.id} value={questionnaire.id}>
                {questionnaire.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 p-2"
            placeholder="Employee email"
            value={form.employeeEmail}
            onChange={(event) => setForm((current) => ({ ...current, employeeEmail: event.target.value }))}
          />
          <input
            className="rounded border border-slate-300 p-2"
            placeholder="Lead email"
            value={form.leadEmail}
            onChange={(event) => setForm((current) => ({ ...current, leadEmail: event.target.value }))}
          />
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Start review
          </button>
        </form>
      </main>
    </>
  );
}
