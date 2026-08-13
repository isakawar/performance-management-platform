# Assessment Demo Slice — Design

**Дата:** 2026-08-12
**Статус:** затверджено для переходу до implementation plan

---

## 1. Контекст і мета

Замість продовження суворої послідовності планів (User & Org Service → Questionnaire Service → Review Service → Assessment Service → ...), користувач хоче спершу отримати клікабельний demo-зріз: створення анкет оцінювання (Questionnaire Builder) і сам функціонал Self/Lead Assessment, з робочим UI. Інтеграція з User & Org Service, RabbitMQ-подіями, повноцінним Review-лайфциклом і Results/Analytics — свідомо відкладена ("все інше доробимо і об'єднаємо пізніше").

Це самостійний, звужений зріз архітектури — не заміна довгострокового плану, а паралельна демонстраційна гілка, яку буде переінтегровано (ймовірно — розбито на Questionnaire Service/Review Service/Assessment Service окремо, підключено до User & Org Service) коли черга дійде до "об'єднання".

## 2. Рішення, прийняті в брейнштормінгу

| Питання | Рішення |
|---|---|
| Автентифікація | Реальний Auth Service (Google OIDC), будь-який `@racoongang.com` акаунт |
| Ролі (Employee/Lead/HR/Admin) | Немає обмежень — будь-який залогінений користувач може і Self, і Lead assessment |
| Структура сервісів | Один новий `services/assessment`: Questionnaire Builder + Self/Lead Assessment разом, без окремого Review Service і без RabbitMQ |
| Frontend → backend | Через мінімальний reverse-proxy в Gateway (`/api/auth/*`, `/api/assessment/*`), а не напряму по портах і не через per-service CORS |
| Версіонування анкет | Просто: одна мутабельна версія Framework/Questionnaire, без snapshot'ів на старті review (BR-13 відкладено) |
| Draft/Submit і ізоляція | Мінімальний набір: DRAFT → SUBMITTED (лок), employee не бачить lead-оцінку (і навпаки), доки обидві не SUBMITTED |
| Frontend розташування | `apps/web` (Next.js), нове workspace-глобо `apps/*` в root `package.json` |

## 3. Архітектура

```
apps/web (Next.js)
   │ HTTP
   ▼
services/gateway  ──/api/auth/*────────▶ services/auth (без змін, вже готовий)
   │
   └──/api/assessment/*────────────────▶ services/assessment (новий)
                                              │
                                       Postgres, схема "assessment"
```

Gateway отримує тонкий reverse-proxy шар (Express-мідлвар, форвардить `Authorization` header як є, без власної guard-логіки на проксі-маршрутах). `services/assessment` верифікує JWT самостійно (той самий патерн `JwtAuthGuard`, що вже спроєктований для `services/org` у чернетці User & Org Service плану — сервіс не довіряє мережевому периметру наосліп).

`services/auth` і Gateway лишаються без функціональних змін (окрім того, що Gateway отримує проксі-шар) — жодних нових залежностей від User & Org Service, жодних роле-клеймів у JWT.

## 4. Дані (Postgres-схема `assessment`)

**Questionnaire Builder:**
- `Framework` — `id (uuid), name (varchar, unique), created_at`
- `Category` — `id, framework_id (FK), name, order_index (int)`
- `Competency` — `id, category_id (FK), name, description, weight (numeric)`
- `CompetencyGradeExpectation` — `id, competency_id (FK), grade (varchar — значення `Grade` enum з `@pmp/shared`), description`
- `Questionnaire` — `id, name, direction (varchar, вільний текст), framework_id (FK), created_at`

**Review/Assessment:**
- `Review` — `id, questionnaire_id (FK), employee_email (varchar), lead_email (varchar), created_at`
- `Assessment` — `id, review_id (FK), type (varchar: SELF|LEAD), status (varchar: DRAFT|SUBMITTED), submitted_at (nullable)`
- `AssessmentAnswer` — `id, assessment_id (FK), competency_id (FK), grade (varchar), comment (nullable text), evidence (nullable text)`, унікальність по `(assessment_id, competency_id)`

`employee_email`/`lead_email` — прості рядки (email), без FK на будь-яку таблицю користувачів (User & Org Service не існує в цьому зрізі). Власник конкретного `Assessment` визначається звіркою `request.user.email` (з JWT) із `employee_email`/`lead_email` відповідного `review` — залежно від `Assessment.type`.

**Ізоляція:** `GET /assessments/:id` повертає відповіді, якщо (а) викликач — власник цього assessment (email збігається), АБО (б) обидва assessment у батьківському review мають статус `SUBMITTED`. Інакше — `403 Forbidden`. Це той самий клас правила, що BR-08/09 у вимогах, спрощений (без окремого кроку "Share Result" — видимість вмикається одразу по факту подвійного submit).

## 5. API (`services/assessment`)

Усі маршрути захищені власним `JwtAuthGuard` сервісу (та сама механіка верифікації, що в Gateway та у чернетці Org Service: `Authorization: Bearer <token>`, той самий `JWT_SECRET`, декодований payload типу `AccessTokenPayload` з `@pmp/shared`). Без role-based guard — будь-який автентифікований користувач має доступ до всіх ендпоінтів.

**Questionnaire Builder:**
- `POST /frameworks` `{ name }` → `201 Framework`
- `GET /frameworks` → `Framework[]`
- `GET /frameworks/:id` → `Framework` з вкладеними `categories[].competencies[].gradeExpectations[]`
- `POST /frameworks/:id/categories` `{ name, orderIndex }` → `201 Category`
- `POST /categories/:id/competencies` `{ name, description, weight, gradeExpectations?: [{ grade, description }] }` → `201 Competency`
- `POST /questionnaires` `{ name, direction, frameworkId }` → `201 Questionnaire`
- `GET /questionnaires` → `Questionnaire[]`
- `GET /questionnaires/:id` → `Questionnaire` з розгорнутою структурою framework (для заповнення форми)

**Review/Assessment:**
- `POST /reviews` `{ questionnaireId, employeeEmail, leadEmail }` → створює `Review` і одразу два `Assessment` (SELF на `employeeEmail`, LEAD на `leadEmail`), обидва `DRAFT` → `201 { review, selfAssessmentId, leadAssessmentId }`
- `GET /reviews` → `Review[]`, де `request.user.email` фігурує як `employeeEmail` або `leadEmail`
- `GET /reviews/:id` → `Review` + статуси обох `Assessment` (без відповідей) + порівняльна таблиця (grade по кожному competency, SELF vs LEAD), присутня в відповіді тільки коли обидва `SUBMITTED`
- `GET /assessments/:id` → `Assessment` з відповідями, підпорядковано правилу ізоляції (п. 4)
- `PUT /assessments/:id/answers` `{ answers: [{ competencyId, grade, comment?, evidence? }] }` → upsert чернетки; `403` якщо викликач не власник; `409`/`400` якщо `status !== DRAFT`
- `POST /assessments/:id/submit` → валідує, що кожен competency анкети має відповідь; переводить у `SUBMITTED`, ставить `submittedAt`; `403` якщо не власник; `400` якщо вже `SUBMITTED` або є непокриті competencies

## 6. Gateway proxy

Мінімальний reverse-proxy шар (Express middleware, напр. `http-proxy-middleware`), змонтований у Gateway окремо від існуючих Nest-контролерів (`/health`, `/auth/me`), щоб уникнути колізій маршрутів:
- `/api/auth/*` → `AUTH_SERVICE_URL` (напр. `http://auth:3001`), шлях без префіксу `/api/auth`
- `/api/assessment/*` → `ASSESSMENT_SERVICE_URL` (напр. `http://assessment:3003`), шлях без префіксу `/api/assessment`

Проксі форвардить `Authorization` header без модифікацій і не виконує власної автентифікації — це відповідальність downstream-сервісів. Існуючі Gateway-маршрути (`/health`, `/auth/me`, `JwtAuthGuard`) лишаються без змін.

## 7. Frontend (`apps/web`, Next.js)

Нове workspace `apps/web`, root `package.json`'s `workspaces` отримує `"apps/*"`.

- `/login` — "Sign in with Google" → `POST /api/auth/google` через Gateway; JWT зберігається в `localStorage` (без SSR-сесій — це demo-зріз, не production auth flow на фронті).
- `/builder` — перелік frameworks/questionnaires; форми послідовного створення (framework → categories → competencies → grade expectations → questionnaire).
- `/reviews` — список review, де поточний користувач — employee або lead; форма "Start review" (questionnaireId, employeeEmail, leadEmail).
- `/reviews/[id]` — картка review: статус SELF/LEAD, посилання на форму заповнення власного assessment; порівняльна таблиця (SELF vs LEAD по competency), видима лише коли обидва submitted.
- `/assessments/[id]` — форма заповнення: по одному блоку на competency (grade select, comment, evidence), кнопки "Save draft" / "Submit".

Без розділення UI по ролях (Employee/Lead/HR/Admin — це "все інше"), без i18n, мінімальна стилізація (Tailwind, без дизайн-системи).

## 8. Тестування

- **`services/assessment`:** unit-тести на чисті функції (валідація submit — усі competencies відповіли; ізоляційна перевірка); інтеграційні тести через testcontainers (реальний Postgres) для repository-шару (upsert відповідей, каскад створення review→assessments); e2e-тести контролерів — той самий патерн TDD, що в `services/auth` і чернетці `services/org` (jest-e2e, `.integration-spec.ts` + `.e2e-spec.ts`).
- **Gateway proxy:** e2e-тест, що підтверджує форвардинг `Authorization` header і статус-коду через `/api/auth/*` та `/api/assessment/*` (мокований upstream або реальний виклик до вже піднятого `services/auth`/`services/assessment` у тестовому оточенні).
- **`apps/web`:** без окремого e2e/Playwright-шару в цьому зрізі; фінальна ручна перевірка через `docker compose up` — той самий формат "Task N: Docker Compose wiring and full-stack verification", що в попередніх планах.

## 9. Що явно відкладено (не в скоупі цього зрізу)

- Інтеграція з User & Org Service (ролі, Direction, LeadAssignment) — JWT і надалі несе лише `{ sub, email }`.
- Окремий Review Service зі статусною машиною (`CREATED→IN_PROGRESS→WAITING_FOR_LEAD→COMPLETED→REOPENED`).
- RabbitMQ / transactional outbox / події між сервісами.
- Версіонування Framework/Questionnaire і snapshot на старті review (BR-13).
- Results/Analytics (Difference, Total, Grade Distribution) — порівняльна таблиця в `GET /reviews/:id` — це найпростіший inline-варіант, не окремий сервіс.
- Notification Service, Audit Service.
- Розділення UI по ролях, i18n, дизайн-система.

Коли черга дійде до "об'єднання всього", `services/assessment` буде переглянуто: ймовірно розділено на Questionnaire/Review/Assessment сервіси окремо (як в оригінальній архітектурі), під'єднано до реального User & Org Service (ролі в JWT, реальні Direction/LeadAssignment замість вільних email-рядків), і Review отримає повноцінну статусну машину.
