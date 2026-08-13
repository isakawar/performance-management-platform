'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { NavBar } from '@/components/nav-bar';

interface GradeExpectation {
  grade: string;
  description: string;
}
interface Competency {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  gradeExpectations: GradeExpectation[];
}
interface Category {
  id: string;
  name: string;
  orderIndex: number;
  competencies: Competency[];
}
interface FrameworkWithStructure {
  id: string;
  name: string;
  categories: Category[];
}

export default function FrameworkDetailPage(): JSX.Element {
  const params = useParams<{ frameworkId: string }>();
  const [framework, setFramework] = useState<FrameworkWithStructure | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [competencyForm, setCompetencyForm] = useState({ categoryId: '', name: '', description: '', weight: '1' });
  const [gradeExpectations, setGradeExpectations] = useState<GradeExpectation[]>([]);
  const [gradeInput, setGradeInput] = useState({ grade: '', description: '' });

  async function refresh(): Promise<void> {
    setFramework(await apiFetch<FrameworkWithStructure>(`/assessment/frameworks/${params.frameworkId}`));
  }

  useEffect(() => {
    refresh();
  }, [params.frameworkId]);

  async function createCategory(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await apiFetch(`/assessment/frameworks/${params.frameworkId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name: categoryName, orderIndex: framework?.categories.length ?? 0 }),
    });
    setCategoryName('');
    await refresh();
  }

  function addGradeExpectation(): void {
    if (!gradeInput.grade || !gradeInput.description) {
      return;
    }
    setGradeExpectations((entries) => [...entries, gradeInput]);
    setGradeInput({ grade: '', description: '' });
  }

  async function createCompetency(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await apiFetch(`/assessment/categories/${competencyForm.categoryId}/competencies`, {
      method: 'POST',
      body: JSON.stringify({
        name: competencyForm.name,
        description: competencyForm.description || undefined,
        weight: Number(competencyForm.weight),
        gradeExpectations,
      }),
    });
    setCompetencyForm({ categoryId: '', name: '', description: '', weight: '1' });
    setGradeExpectations([]);
    await refresh();
  }

  if (!framework) {
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
        <h1 className="text-2xl font-semibold">{framework.name}</h1>

        {framework.categories.map((category) => (
          <section key={category.id} className="mt-6 rounded border border-slate-200 p-4">
            <h2 className="text-lg font-medium">{category.name}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {category.competencies.map((competency) => (
                <li key={competency.id} className="rounded bg-slate-100 p-2">
                  <div className="font-medium">
                    {competency.name} (weight {competency.weight})
                  </div>
                  {competency.description && <div className="text-sm text-slate-600">{competency.description}</div>}
                  <ul className="mt-1 text-xs text-slate-500">
                    {competency.gradeExpectations.map((entry) => (
                      <li key={entry.grade}>
                        {entry.grade}: {entry.description}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <form onSubmit={createCategory} className="mt-6 flex gap-2">
          <input
            className="rounded border border-slate-300 p-2"
            placeholder="Category name"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Add category
          </button>
        </form>

        <form onSubmit={createCompetency} className="mt-6 flex flex-col gap-2 rounded border border-slate-200 p-4">
          <h3 className="font-medium">Add competency</h3>
          <select
            className="rounded border border-slate-300 p-2"
            value={competencyForm.categoryId}
            onChange={(event) => setCompetencyForm((form) => ({ ...form, categoryId: event.target.value }))}
          >
            <option value="">Select category…</option>
            {framework.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 p-2"
            placeholder="Competency name"
            value={competencyForm.name}
            onChange={(event) => setCompetencyForm((form) => ({ ...form, name: event.target.value }))}
          />
          <input
            className="rounded border border-slate-300 p-2"
            placeholder="Description"
            value={competencyForm.description}
            onChange={(event) => setCompetencyForm((form) => ({ ...form, description: event.target.value }))}
          />
          <input
            className="rounded border border-slate-300 p-2"
            placeholder="Weight"
            type="number"
            value={competencyForm.weight}
            onChange={(event) => setCompetencyForm((form) => ({ ...form, weight: event.target.value }))}
          />
          <div className="flex gap-2">
            <input
              className="rounded border border-slate-300 p-2"
              placeholder="Grade (e.g. SENIOR)"
              value={gradeInput.grade}
              onChange={(event) => setGradeInput((input) => ({ ...input, grade: event.target.value }))}
            />
            <input
              className="rounded border border-slate-300 p-2"
              placeholder="Expectation description"
              value={gradeInput.description}
              onChange={(event) => setGradeInput((input) => ({ ...input, description: event.target.value }))}
            />
            <button type="button" onClick={addGradeExpectation} className="rounded border border-slate-300 px-3">
              + Add grade
            </button>
          </div>
          <ul className="text-xs text-slate-500">
            {gradeExpectations.map((entry) => (
              <li key={entry.grade}>
                {entry.grade}: {entry.description}
              </li>
            ))}
          </ul>
          <button type="submit" className="mt-2 rounded bg-slate-900 px-4 py-2 text-white">
            Add competency
          </button>
        </form>
      </main>
    </>
  );
}
