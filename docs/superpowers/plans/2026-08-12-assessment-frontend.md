# Assessment Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/web` (Next.js) — a clickable UI for Google login, Questionnaire Builder, starting reviews, and filling Self/Lead assessments — talking to the backend exclusively through the Gateway's `/api/*` proxy.

**Architecture:** Next.js App Router, client-side only (no SSR data fetching, no server actions) — every page is a client component that calls the Gateway via `fetch`, using a JWT held in `localStorage`. A thin `lib/api-client.ts` centralizes the base URL and the `Authorization` header attachment; page components are otherwise plain React with local `useState`/`useEffect`. This mirrors the backend plan's minimalism: no state management library, no server components, no design system — Tailwind utility classes only.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript 5 (`strict: true`), Tailwind CSS. No testing framework beyond the final manual `docker compose up` verification (per the approved design, §8 — no Playwright/e2e layer in this slice).

## Global Constraints

- Node.js 20 LTS; TypeScript `strict: true`.
- npm workspaces — this plan adds `apps/*` to the root `package.json`'s `workspaces` array (currently `["packages/*", "services/*"]`) as its very first step, since nothing in this repo has needed an `apps/` directory before now.
- Commit messages, PR titles/bodies, and code comments must never reference AI/Claude/Copilot or similar tooling — hard repo rule. Verify every commit with `git log -1 --format=%B` and amend immediately if attribution slipped in.
- **Depends on `docs/superpowers/plans/2026-08-12-assessment-service.md` being complete and merged first** — this plan calls `POST /api/auth/google`, `GET/POST /api/assessment/frameworks`, `GET/POST /api/assessment/questionnaires`, `GET/POST /api/assessment/reviews`, `GET /api/assessment/reviews/:id`, `GET/PUT /api/assessment/assessments/:id`, `POST /api/assessment/assessments/:id/submit` — all of which only exist once that plan lands.
- JWT storage: `localStorage` under key `pmp_access_token` — no cookies, no SSR session, no refresh-token flow. This is an explicit, approved simplification (design doc §7) — do not add auth middleware, `next-auth`, or server-side session handling.
- No role-based UI (Employee/Lead/HR/Admin views) — every logged-in user sees the same navigation and can reach every page, matching the backend's no-RBAC scope boundary.
- Gateway base URL: `NEXT_PUBLIC_GATEWAY_URL`, defaulting to `http://localhost:3000` for local dev.

---

## File Structure

```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .eslintrc.json
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx                        # redirects to /login or /reviews
    │   ├── login/page.tsx
    │   ├── builder/page.tsx
    │   ├── builder/[frameworkId]/page.tsx
    │   ├── reviews/page.tsx
    │   ├── reviews/[id]/page.tsx
    │   └── assessments/[id]/page.tsx
    ├── lib/
    │   ├── api-client.ts
    │   ├── auth-storage.ts
    │   └── use-current-user.ts
    └── components/
        └── nav-bar.tsx

package.json           # modified: workspaces gains "apps/*"
```

---

### Task 1: `apps/web` scaffolding — Next.js skeleton with a placeholder home page

**Files:**
- Modify: `package.json` (root)
- Create: `apps/web/package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `.eslintrc.json`
- Create: `apps/web/src/app/layout.tsx`, `globals.css`, `page.tsx`

**Interfaces:**
- Produces: a running Next.js dev server (`npm run dev --workspace=@pmp/web`) on port 3010, serving `/` (a placeholder page every later task replaces piece by piece). Establishes the workspace so every later task's files resolve correctly.

- [ ] **Step 1: Update root `package.json`**

Read the current file first. Change the `workspaces` array from `["packages/*", "services/*"]` to `["packages/*", "services/*", "apps/*"]`. Nothing else in the file changes.

- [ ] **Step 2: `apps/web/package.json`**

```json
{
  "name": "@pmp/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3010",
    "build": "next build",
    "start": "next start -p 3010",
    "lint": "next lint",
    "test": "echo \"no unit tests in this slice\" && exit 0"
  },
  "dependencies": {
    "next": "^14.2.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.15",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.5.4"
  }
}
```

`test` is a no-op that exits 0 — this keeps `npm run test --workspaces --if-present` (used by root CI) from failing on a workspace that has no unit tests in this slice, matching the design's explicit "no Playwright/e2e layer" decision, without breaking the existing CI script shape.

- [ ] **Step 3: `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

This does not extend `../../tsconfig.base.json` — Next.js's own build pipeline requires specific compiler options (`moduleResolution: "bundler"`, `jsx: "preserve"`, `noEmit: true`) that conflict with the base config's `module: "commonjs"`/`declaration: true`, which are meant for the NestJS services. `strict: true` is preserved independently, satisfying the repo-wide constraint without inheriting incompatible settings.

- [ ] **Step 4: `apps/web/next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
```

- [ ] **Step 5: `apps/web/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 6: `apps/web/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: `apps/web/.eslintrc.json`**

```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **Step 8: `apps/web/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: `apps/web/src/app/layout.tsx`**

```tsx
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
```

- [ ] **Step 10: `apps/web/src/app/page.tsx`**

```tsx
export default function HomePage(): JSX.Element {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">PMP Assessment Demo</h1>
      <p className="mt-2 text-slate-600">Placeholder home page — replaced in a later task.</p>
    </main>
  );
}
```

- [ ] **Step 11: Install and verify the dev server boots**

Run: `npm install`
Then run in the background and check it serves a 200: `npm run dev --workspace=@pmp/web &` then `sleep 3 && curl -sf http://localhost:3010 -o /dev/null -w '%{http_code}\n'`, then stop the dev server (`kill %1` or equivalent).
Expected: `curl` prints `200`.

- [ ] **Step 12: Build to confirm production build succeeds**

Run: `npm run build --workspace=@pmp/web`
Expected: succeeds, produces `apps/web/.next/`.

- [ ] **Step 13: Commit**

```bash
git checkout -b feature/assessment-frontend
git add package.json apps/web package-lock.json
git commit -m "feat(web): add Next.js skeleton"
```

---

### Task 2: API client and auth storage

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/auth-storage.ts`

**Interfaces:**
- Produces: `getAccessToken(): string | null`, `setAccessToken(token: string): void`, `clearAccessToken(): void` (all in `auth-storage.ts`, wrapping `localStorage['pmp_access_token']`, guarded for SSR — `typeof window === 'undefined'` returns `null`/no-ops, since Next.js may evaluate modules during the build's static analysis pass even though these pages are client components); `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` (in `api-client.ts`) — prepends `NEXT_PUBLIC_GATEWAY_URL` (default `http://localhost:3000`) + `/api`, attaches `Authorization: Bearer <token>` when a token is present, throws an `Error` with the response status and body text on a non-2xx response, otherwise parses and returns JSON. Every page from Task 3 onward calls `apiFetch` exclusively — no page ever calls `fetch` directly.

- [ ] **Step 1: `apps/web/src/lib/auth-storage.ts`**

```ts
const STORAGE_KEY = 'pmp_access_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: `apps/web/src/lib/api-client.ts`**

```ts
import { getAccessToken } from './auth-storage';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${GATEWAY_URL}/api${path}`, { ...init, headers });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, `${response.status} ${path}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
```

- [ ] **Step 3: Build to confirm it compiles**

Run: `npm run build --workspace=@pmp/web`
Expected: succeeds (these modules aren't imported anywhere yet, but TypeScript still type-checks them during the build).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): add API client and auth token storage"
```

---

### Task 3: Login page

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/components/nav-bar.tsx`
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 2). `POST /api/auth/google` — the real Auth Service endpoint — expects `{ idToken: string }` and returns `{ accessToken: string }`.
- Produces: `/login` page. Since this demo has no real Google Identity Services widget wired in (that requires a registered OAuth client + domain verification beyond this slice's scope), the login page accepts a **pasted Google ID token** in a text field — a real one, obtained by the user via `https://developers.google.com/oauthplayground` or their own script, still verified for real by the already-working Auth Service (audience, `email_verified`, `hd` domain claim, all real checks — nothing here is mocked). This keeps "real Google OIDC" (the earlier decision) while not requiring a Google Cloud Console app-registration task inside this plan. Note this explicitly in the PR description as a known interim UX gap — a proper "Sign in with Google" button is a follow-up once this repo has a registered OAuth web client ID for the frontend origin.

- [ ] **Step 1: `apps/web/src/components/nav-bar.tsx`**

```tsx
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
```

- [ ] **Step 2: `apps/web/src/app/login/page.tsx`**

```tsx
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
```

- [ ] **Step 3: Update `apps/web/src/app/page.tsx`**

```tsx
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
```

- [ ] **Step 4: Build to confirm it compiles**

Run: `npm run build --workspace=@pmp/web`
Expected: succeeds.

- [ ] **Step 5: Manual verification**

Run: `npm run dev --workspace=@pmp/web &`, then visit `http://localhost:3010/login` in a browser (or `curl -sf http://localhost:3010/login -o /dev/null -w '%{http_code}\n'` for a quick smoke check).
Expected: page renders / `curl` prints `200`. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/login apps/web/src/app/page.tsx apps/web/src/components
git commit -m "feat(web): add login page"
```

---

### Task 4: Questionnaire Builder pages

**Files:**
- Create: `apps/web/src/app/builder/page.tsx`
- Create: `apps/web/src/app/builder/[frameworkId]/page.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 2); `GET/POST /api/assessment/frameworks`, `GET /api/assessment/frameworks/:id`, `POST /api/assessment/frameworks/:id/categories`, `POST /api/assessment/categories/:id/competencies`, `GET/POST /api/assessment/questionnaires` (all from the backend plan).
- Produces: `/builder` (list frameworks + questionnaires, forms to create each) and `/builder/[frameworkId]` (add categories, add competencies with grade expectations, view the nested structure).

- [ ] **Step 1: `apps/web/src/app/builder/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { NavBar } from '@/components/nav-bar';

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
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [frameworkName, setFrameworkName] = useState('');
  const [questionnaireForm, setQuestionnaireForm] = useState({ name: '', direction: '', frameworkId: '' });

  async function refresh(): Promise<void> {
    setFrameworks(await apiFetch<Framework[]>('/assessment/frameworks'));
    setQuestionnaires(await apiFetch<Questionnaire[]>('/assessment/questionnaires'));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createFramework(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await apiFetch('/assessment/frameworks', { method: 'POST', body: JSON.stringify({ name: frameworkName }) });
    setFrameworkName('');
    await refresh();
  }

  async function createQuestionnaire(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await apiFetch('/assessment/questionnaires', { method: 'POST', body: JSON.stringify(questionnaireForm) });
    setQuestionnaireForm({ name: '', direction: '', frameworkId: '' });
    await refresh();
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
      </main>
    </>
  );
}
```

- [ ] **Step 2: `apps/web/src/app/builder/[frameworkId]/page.tsx`**

```tsx
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
```

- [ ] **Step 3: Build to confirm it compiles**

Run: `npm run build --workspace=@pmp/web`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/builder
git commit -m "feat(web): add Questionnaire Builder pages"
```

---

### Task 5: Review list and "start review" pages

**Files:**
- Create: `apps/web/src/app/reviews/page.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 2); `GET /api/assessment/reviews`, `POST /api/assessment/reviews`, `GET /api/assessment/questionnaires`.
- Produces: `/reviews` — lists reviews the current user is part of (as employee or lead), and a form to start a new one.

- [ ] **Step 1: `apps/web/src/app/reviews/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Build to confirm it compiles**

Run: `npm run build --workspace=@pmp/web`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/reviews/page.tsx
git commit -m "feat(web): add reviews list and start-review form"
```

---

### Task 6: Review detail page (status + comparison)

**Files:**
- Create: `apps/web/src/app/reviews/[id]/page.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 2); `GET /api/assessment/reviews/:id` (returns `{ id, employeeEmail, leadEmail, assessments: [{id, type, status}], comparison?: [{competencyId, selfGrade, leadGrade}] }`).
- Produces: `/reviews/[id]` — shows both assessments' status with a link to fill each, and the comparison table once both are `SUBMITTED`.

- [ ] **Step 1: `apps/web/src/app/reviews/[id]/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Build to confirm it compiles**

Run: `npm run build --workspace=@pmp/web`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/reviews/[id]
git commit -m "feat(web): add review detail page with comparison table"
```

---

### Task 7: Assessment fill-in page

**Files:**
- Create: `apps/web/src/app/assessments/[id]/page.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 2); `GET /api/assessment/assessments/:id` (returns `{ id, reviewId, type, status, answers: [{competencyId, grade, comment, evidence}] }` — note: this response does not include the competency structure itself, only saved answers; the form derives its competency list from the review's questionnaire, fetched separately via `GET /api/assessment/reviews/:reviewId` → `questionnaireId` → `GET /api/assessment/questionnaires/:questionnaireId`), `PUT /api/assessment/assessments/:id/answers`, `POST /api/assessment/assessments/:id/submit`.
- Produces: `/assessments/[id]` — one form field group per competency (grade select, comment, evidence), "Save draft" and "Submit" buttons. Read-only once `SUBMITTED`.

- [ ] **Step 1: `apps/web/src/app/assessments/[id]/page.tsx`**

```tsx
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
    setDrafts((current) => ({
      ...current,
      [competencyId]: { competencyId, grade: '', ...current[competencyId], ...changes },
    }));
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
```

- [ ] **Step 2: Build to confirm it compiles**

Run: `npm run build --workspace=@pmp/web`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/assessments
git commit -m "feat(web): add assessment fill-in page"
```

---

### Task 8: Docker Compose wiring and full-stack manual verification

**Files:**
- Create: `apps/web/Dockerfile`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `docker compose up --build` runs the whole stack including `web`, reachable at `http://localhost:3010`, pointed at the Gateway via `NEXT_PUBLIC_GATEWAY_URL`.

- [ ] **Step 1: `apps/web/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
RUN npm ci
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL}
RUN npm run build --workspace=@pmp/web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/web/.next ./apps/web/.next
COPY --from=build --chown=node:node /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3010
CMD ["npx", "--prefix", "apps/web", "next", "start", "-p", "3010"]
```

`NEXT_PUBLIC_*` environment variables are baked into the client bundle at build time by Next.js — unlike the backend services, this can't be swapped at container-start time via `docker-compose.yml`'s `environment:` block alone, hence the build `ARG`. `apps/web/public` may not exist yet in this repo; if the `COPY` step fails because the directory is missing, create an empty `apps/web/public/.gitkeep` file first (Docker's `COPY` requires the source path to exist).

- [ ] **Step 2: Modify `docker-compose.yml`** — add a `web` service:

```yaml
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_GATEWAY_URL: http://localhost:3000
    restart: unless-stopped
    ports:
      - "127.0.0.1:3010:3010"
    depends_on:
      gateway:
        condition: service_healthy
```

No healthcheck block — Next.js's production server has no built-in `/health` route, and adding one is out of scope for this slice; `depends_on: gateway: condition: service_healthy` is sufficient ordering for manual verification.

- [ ] **Step 3: Build and start the full stack**

Run: `JWT_SECRET=pmp_dev_jwt_secret_change_me GOOGLE_CLIENT_ID=dev-google-client-id docker compose up --build -d`
Expected: six containers start; `web` reaches `running` (no healthcheck, so `docker compose ps` shows it as `Up`, not `healthy`).

- [ ] **Step 4: Verify the frontend serves the login page**

Run: `curl -sf http://localhost:3010/login -o /dev/null -w '%{http_code}\n'`
Expected: `200`.

- [ ] **Step 5: Manual click-through verification**

Open `http://localhost:3010` in a browser. Obtain a real Google ID token for a `@racoongang.com` test account (via `https://developers.google.com/oauthplayground`, scope `openid email`, using the same `GOOGLE_CLIENT_ID` configured for the `auth` service), paste it into `/login`, confirm redirect to `/reviews`. Create a framework with one category and one competency (with grade expectations) at `/builder`. Create a questionnaire referencing it. Start a review naming the logged-in account as both `employeeEmail` and `leadEmail` (simplest way to exercise both roles as one person, matching the design's "no restrictions" decision). Fill and submit the SELF assessment, then the LEAD assessment. Confirm the comparison table appears on `/reviews/[id]`.

This step cannot be scripted (it requires a real Google account and manual browser interaction) — record the outcome in the task's final report; if any step fails, fix it before considering the plan complete.

- [ ] **Step 6: Tear down**

Run: `JWT_SECRET=pmp_dev_jwt_secret_change_me GOOGLE_CLIENT_ID=dev-google-client-id docker compose down -v`
Expected: containers and the `postgres_data` volume are removed cleanly.

- [ ] **Step 7: Commit**

```bash
git add apps/web/Dockerfile docker-compose.yml
git commit -m "feat(infra): wire web frontend into docker-compose"
```

- [ ] **Step 8: Push the branch, open a PR, confirm CI passes**

Run: `git push -u origin feature/assessment-frontend`
Open a PR against `main`. Then: `gh run list --branch feature/assessment-frontend --limit 1`
Expected: `completed` / `success`. `apps/web`'s `test` script is a no-op (Task 1), so root CI's `npm run test --workspaces --if-present` passes trivially for it; `npm run build --workspaces --if-present` and `npm run lint --workspaces --if-present` are the real gates here. If it fails, `gh run view --log-failed` and fix before proceeding.

---

## Self-Review Notes

- **Spec coverage:** implements design doc §7 in full — all five pages (`/login`, `/builder` + `/builder/[frameworkId]`, `/reviews`, `/reviews/[id]`, `/assessments/[id]`), no role-based UI, no i18n, Tailwind-only styling, `localStorage` token storage, all calls through the Gateway's `/api/*` proxy (never direct service ports) — matching the approved "Frontend → backend" decision. The one deviation from a literal "Sign in with Google" button (a pasted-ID-token form instead) is disclosed as a known interim gap, not a silent scope cut — real OIDC verification still happens server-side, nothing is mocked.
- **Placeholder scan:** no TBD/TODO; every step has concrete file content or an exact command with expected output. Task 8's manual click-through (Step 5) is inherently unscriptable (real Google account required) — this is explicitly disclosed as such, not a hidden gap, and mirrors the design's own explicit choice not to add a Playwright/e2e layer to this slice.
- **Type consistency:** `Framework`/`Category`/`Competency`/`GradeExpectation`/`Questionnaire`/`Review`/`AssessmentDetail`/`ComparisonEntry` TypeScript interfaces across Tasks 4–7 match the exact JSON shapes the backend plan's controllers return (verified against `docs/superpowers/plans/2026-08-12-assessment-service.md`'s Task 3–7 response bodies).
- **Scope check:** one coherent frontend slice, entirely dependent on (but not duplicating) the backend plan — independently reviewable as "does the UI correctly drive the already-tested API," with its own Docker/compose wiring and its own final manual verification step, mirroring every prior plan's closing pattern.
