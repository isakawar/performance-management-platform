'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { NavBar } from '@/components/nav-bar';
import { useRequireAuth } from '@/lib/use-current-user';

interface Framework {
  id: string;
  name: string;
}
interface Questionnaire {
  id: string;
  name: string;
  direction: string;
  frameworkId: string;
}

export default function BuilderPage(): JSX.Element {
  useRequireAuth();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [frameworkName, setFrameworkName] = useState('');
  const [questionnaireForm, setQuestionnaireForm] = useState({ name: '', direction: '', frameworkId: '' });
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      setFrameworks(await apiFetch<Framework[]>('/assessment/frameworks'));
      setQuestionnaires(await apiFetch<Questionnaire[]>('/assessment/questionnaires'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load builder data');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createFramework(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch('/assessment/frameworks', { method: 'POST', body: JSON.stringify({ name: frameworkName }) });
      setFrameworkName('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create framework');
    }
  }

  async function createQuestionnaire(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch('/assessment/questionnaires', { method: 'POST', body: JSON.stringify(questionnaireForm) });
      setQuestionnaireForm({ name: '', direction: '', frameworkId: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create questionnaire');
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Questionnaire Builder</h1>

        <section className="mt-8">
          <h2 className="text-lg font-medium">Frameworks</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {frameworks.map((framework) => (
              <li key={framework.id}>
                <Link href={`/builder/${framework.id}`} className="text-blue-700 underline">
                  {framework.name}
                </Link>
              </li>
            ))}
          </ul>
          <form onSubmit={createFramework} className="mt-4 flex gap-2">
            <input
              className="rounded border border-slate-300 p-2"
              placeholder="Framework name"
              value={frameworkName}
              onChange={(event) => setFrameworkName(event.target.value)}
            />
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
              Create framework
            </button>
          </form>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">Questionnaires</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {questionnaires.map((questionnaire) => (
              <li key={questionnaire.id}>
                {questionnaire.name} ({questionnaire.direction})
              </li>
            ))}
          </ul>
          <form onSubmit={createQuestionnaire} className="mt-4 flex flex-wrap gap-2">
            <input
              className="rounded border border-slate-300 p-2"
              placeholder="Questionnaire name"
              value={questionnaireForm.name}
              onChange={(event) => setQuestionnaireForm((form) => ({ ...form, name: event.target.value }))}
            />
            <input
              className="rounded border border-slate-300 p-2"
              placeholder="Direction (e.g. QA)"
              value={questionnaireForm.direction}
              onChange={(event) => setQuestionnaireForm((form) => ({ ...form, direction: event.target.value }))}
            />
            <select
              className="rounded border border-slate-300 p-2"
              value={questionnaireForm.frameworkId}
              onChange={(event) => setQuestionnaireForm((form) => ({ ...form, frameworkId: event.target.value }))}
            >
              <option value="">Select framework…</option>
              {frameworks.map((framework) => (
                <option key={framework.id} value={framework.id}>
                  {framework.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
              Create questionnaire
            </button>
          </form>
        </section>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </main>
    </>
  );
}
