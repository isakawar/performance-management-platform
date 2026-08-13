'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { NavBar } from '@/components/nav-bar';

const GRADES = ['UNWILLING', 'JUNIOR', 'JUNIOR+', 'MIDDLE', 'MIDDLE+', 'SENIOR', 'LEAD'];

interface AnswerEntry {
  competencyId: string;
  grade: string;
  comment?: string;
  evidence?: string;
}
interface AssessmentDetail {
  id: string;
  reviewId: string;
  type: 'SELF' | 'LEAD';
  status: 'DRAFT' | 'SUBMITTED';
  answers: AnswerEntry[];
}
interface Review {
  id: string;
  employeeEmail: string;
  leadEmail: string;
  questionnaireId: string;
}
interface Competency {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  competencies: Competency[];
}
interface Questionnaire {
  id: string;
  framework: { categories: Category[] };
}

export default function AssessmentPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AnswerEntry>>({});
  const [error, setError] = useState<string | null>(null);

  const competencies = useMemo(
    () => questionnaire?.framework.categories.flatMap((category) => category.competencies) ?? [],
    [questionnaire],
  );

  useEffect(() => {
    async function load(): Promise<void> {
      const fetchedAssessment = await apiFetch<AssessmentDetail>(`/assessment/assessments/${params.id}`);
      setAssessment(fetchedAssessment);

      const review = await apiFetch<Review>(`/assessment/reviews/${fetchedAssessment.reviewId}`);
      const fetchedQuestionnaire = await apiFetch<Questionnaire>(`/assessment/questionnaires/${review.questionnaireId}`);
      setQuestionnaire(fetchedQuestionnaire);

      const seeded: Record<string, AnswerEntry> = {};
      for (const answer of fetchedAssessment.answers) {
        seeded[answer.competencyId] = answer;
      }
      setDrafts(seeded);
    }
    load();
  }, [params.id]);

  function updateDraft(competencyId: string, changes: Partial<AnswerEntry>): void {
    setDrafts((current) => {
      const base = current[competencyId];
      const merged: AnswerEntry = {
        competencyId,
        grade: changes.grade ?? base?.grade ?? '',
        comment: changes.comment ?? base?.comment,
        evidence: changes.evidence ?? base?.evidence,
      };
      return { ...current, [competencyId]: merged };
    });
  }

  async function saveDraft(): Promise<void> {
    setError(null);
    try {
      await apiFetch(`/assessment/assessments/${params.id}/answers`, {
        method: 'PUT',
        body: JSON.stringify({ answers: Object.values(drafts).filter((entry) => entry.grade) }),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save draft');
    }
  }

  async function submit(): Promise<void> {
    setError(null);
    try {
      await saveDraft();
      const updated = await apiFetch<AssessmentDetail>(`/assessment/assessments/${params.id}/submit`, { method: 'POST' });
      setAssessment(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit');
    }
  }

  if (!assessment || !questionnaire) {
    return (
      <>
        <NavBar />
        <main className="p-8">Loading…</main>
      </>
    );
  }

  const readOnly = assessment.status === 'SUBMITTED';

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">
          {assessment.type} assessment — {assessment.status}
        </h1>

        <div className="mt-6 flex flex-col gap-4">
          {competencies.map((competency) => {
            const draft = drafts[competency.id] ?? { competencyId: competency.id, grade: '' };
            return (
              <div key={competency.id} className="rounded border border-slate-200 p-3">
                <div className="font-medium">{competency.name}</div>
                <select
                  className="mt-2 rounded border border-slate-300 p-2"
                  value={draft.grade}
                  disabled={readOnly}
                  onChange={(event) => updateDraft(competency.id, { grade: event.target.value })}
                >
                  <option value="">Select grade…</option>
                  {GRADES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                  placeholder="Comment"
                  value={draft.comment ?? ''}
                  disabled={readOnly}
                  onChange={(event) => updateDraft(competency.id, { comment: event.target.value })}
                />
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                  placeholder="Evidence"
                  value={draft.evidence ?? ''}
                  disabled={readOnly}
                  onChange={(event) => updateDraft(competency.id, { evidence: event.target.value })}
                />
              </div>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {!readOnly && (
          <div className="mt-6 flex gap-3">
            <button onClick={saveDraft} className="rounded border border-slate-300 px-4 py-2">
              Save draft
            </button>
            <button onClick={submit} className="rounded bg-slate-900 px-4 py-2 text-white">
              Submit
            </button>
          </div>
        )}
      </main>
    </>
  );
}
