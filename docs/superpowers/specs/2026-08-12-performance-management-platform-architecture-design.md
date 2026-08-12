# Performance Management Platform — Architecture Design

**Дата:** 2026-08-12
**Статус:** затверджено для переходу до implementation plan
**Базується на:** `docs/performance_management_platform_detailed_description.md` (v0.1) та наданому Excel-прикладі `[Vlad] PERFORMANCE PROFILE v0.9 (1).xlsx`

---

## 1. Контекст і скоуп

Документ вимог (`performance_management_platform_detailed_description.md`) вже детально описує бізнес-логіку, ролі, сутності та MVP-скоуп (розділ 42 цього документа). Цей architecture design покриває **технічну реалізацію MVP**, спроєктовану так, щоб легко розширюватись future-модулями (Development Plan, Goals, Feedback, 1-on-1, Promotion Review — розділ 41 вимог).

Excel-файл `PERFORMANCE PROFILE v0.9` підтверджує структуру Hard Skills / Soft Skills, Self vs Expert Assessment, Grade before/after — це перший framework (QA), який має бути перенесений у Questionnaire Builder як приклад, а не захардкоджений.

## 2. Рішення, прийняті в брейнштормінгу

| Питання | Рішення |
|---|---|
| Технологічний стек | Node.js/TypeScript full-stack (NestJS + Next.js), PostgreSQL |
| SSO провайдер | Google Workspace (OIDC), домен `@racoongang.com` |
| Хостинг | Не визначено заздалегідь; **обов'язково** — все в Docker-контейнерах, легко розгорнути на VPS чи будь-де |
| Notifications у MVP | Так, базові email (Review assigned, Waiting for Lead, Result shared, deadline reminder) |
| Структура репозиторію | Монорепо (backend, frontend, shared types/DTO) |
| Архітектурний стиль | **Мікросервіси** (змінено з початкової рекомендації "модульний моноліт" за прямим запитом користувача) |
| Оркестрація | Docker Compose (не Kubernetes) — відповідає вимозі простого розгортання на VPS |
| Міжсервісна комунікація | REST (синхронно) + черга повідомлень RabbitMQ (асинхронні події) |
| Дані | Один керований PostgreSQL-інстанс, окрема схема на сервіс (не окремі СУБД) |
| Безпека / комплаєнс | ISO/IEC 27001:2022 ISMS, стандартний Annex A baseline (немає задокументованих внутрішніх політик, під які потрібно підлаштовуватись) |

## 3. Архітектура

```
                         ┌─────────────────┐
                         │   Next.js Web    │  (Employee / Lead / HR / Admin UI)
                         └────────┬─────────┘
                                  │ HTTPS
                         ┌────────▼─────────┐
                         │   API Gateway/BFF │  ← auth-перевірка, роутинг, агрегація
                         └───┬───┬───┬───┬───┘
              ┌──────────────┘   │   │   └──────────────┐
        ┌─────▼─────┐    ┌───────▼───────┐  ┌──────▼──────┐   ┌────▼─────┐
        │   Auth    │    │  User & Org   │  │Questionnaire│   │  Review   │
        │  Service  │    │   Service     │  │   Service   │   │  Service  │
        └───────────┘    └───────────────┘  └─────────────┘   └────┬──────┘
                                                                      │
                                                              ┌───────▼───────┐
                                                              │  Assessment   │
                                                              │   Service     │
                                                              └───────┬───────┘
                                                                      │ events (RabbitMQ)
                          ┌──────────────┬─────────────┬─────────────┤
                    ┌─────▼─────┐  ┌─────▼──────┐┌─────▼──────┐
                    │  Results  │  │Notification││   Audit    │
                    │/Analytics │  │  Service   ││  Service   │
                    └───────────┘  └────────────┘└────────────┘

Усі сервіси ↔ один PostgreSQL-інстанс, окрема схема на сервіс.
```

### 3.1. Межі сервісів (bounded contexts)

1. **Auth Service** — Google OIDC handshake, перевірка домену `@racoongang.com` (BR-01/02), видача JWT/сесії, RBAC-claims.
2. **User & Org Service** — Users, Directions, Roles, LeadAssignment, onboarding, permissions (BR-03–06).
3. **Questionnaire Service** — Framework/Category/Competency/Weight, Questionnaire Builder, версіонування (розділ 10 вимог), import/export Excel/CSV.
4. **Review Service** — PerformanceReview, ReviewParticipant, статусна машина (CREATED→IN_PROGRESS→WAITING_FOR_LEAD→COMPLETED→REOPENED, розділ 13), запуск review (масово/командно/індивідуально).
5. **Assessment Service** — Self/Lead Assessment, Answer, Evidence, Comment; ізоляція Self від Lead до Submit (BR-08); draft/submit/immutability (BR-09, BR-10).
6. **Results/Analytics Service** — Difference, Total, категорійні бали, Grade Distribution/Matrix, Grade Before/After, HR/Lead dashboards, історія, динаміка розвитку.
7. **Notification Service** — консьюмить події з черги, надсилає email.
8. **Audit Service** — консьюмить події з усіх сервісів, пише immutable audit log (розділ 38 вимог) — критично для ISO 27001 A.8.15.
9. **API Gateway/BFF** — єдина точка входу, перевірка JWT, контекстний RBAC (розділ 47 вимог: доступ залежить не лише від ролі, а й від контексту — Employee/Lead/HR/Admin), агрегація відповідей для UI.

### 3.2. Потік подій (приклад наскрізного сценарію)

```
Employee Submit Self Assessment
   → Assessment Service: записує відповіді, блокує редагування (транзакція)
   → publish AssessmentSubmitted{type: SELF, reviewId, userId}
        → Review Service: consume → перехід статусу IN_PROGRESS → WAITING_FOR_LEAD
        → Audit Service: consume → запис в audit log
        → Notification Service: consume → email Lead

Lead Submit Lead Assessment
   → publish AssessmentSubmitted{type: LEAD, reviewId, userId}
        → Review Service: consume → статус → COMPLETED
        → Results Service: consume → розрахунок Difference/Total/Grade Distribution
        → Audit Service, Notification Service: як вище
```

Доставка подій — **transactional outbox pattern**: сервіс пише подію в свою БД-транзакцію разом з бізнес-зміною; окремий relay-процес публікує в RabbitMQ. Виключає втрату audit-подій при падінні сервісу між DB-commit і publish. Consumers ідемпотентні (unique `eventId` перевірка) для коректної обробки at-least-once delivery.

### 3.3. Дані

Один керований PostgreSQL 16, окрема схема на сервіс (`auth`, `org`, `questionnaire`, `review`, `assessment`, `results`, `audit`). Cross-schema SQL-запити заборонені — тільки через API/події. Спрощує backup/шифрування at-rest під ISO 27001 (один контур замість N окремих СУБД).

Ключовий принцип із вимог (розділ 43): Review/Assessment **фіксують framework version** на момент старту, а не посилаються на актуальну. Versioning живе у Questionnaire Service; snapshot competency-структури копіюється в Assessment Service на старті review — зміна шаблону заднім числом не впливає на завершені reviews (BR-13).

## 4. Безпека / ISO 27001:2022 baseline

Немає задокументованих внутрішніх ISMS-політик компанії, під які треба підлаштувати архітектуру — застосовується стандартний технічний Annex A baseline:

- **Access control (A.5.15, A.8.2/8.3):** OIDC SSO + JWT; RBAC на Gateway + контекстна перевірка на рівні кожного сервісу.
- **Cryptography (A.8.24):** TLS для зовнішнього трафіку; шифрування Postgres at-rest; секрети (DB creds, OIDC client secret, SMTP creds) через Docker secrets/Vault, ніколи в репозиторії.
- **Logging & monitoring (A.8.15/8.16):** Audit Service — append-only бізнес-audit (actor/timestamp/entity/old-new value, розділ 38 вимог); окремо технічні логи (structured JSON) з централізованим collector.
- **Secure SDLC (A.8.25–8.29):** dependency scanning (Snyk/npm audit) і SAST у CI, обов'язковий code review, розділені середовища dev/staging/prod.
- **Backup & continuity (A.8.13):** регулярний backup PostgreSQL, задокументовані RTO/RPO, періодичний тест відновлення.
- **Data retention (A.8.10):** політика зберігання персональних даних/оцінок — history залишається immutable, але з визначеним retention/deletion при офбордингу співробітника.

## 5. Обробка помилок і узгодженість

- **Синхронні виклики** (Gateway → сервіс, Review → Assessment при старті): retry з backoff + circuit breaker, timeout 5с за замовчуванням; недоступний сервіс → 503 з зрозумілим повідомленням.
- **Асинхронні події:** at-least-once delivery, ідемпотентні consumers.
- **Критичні бізнес-інваріанти в межах одного сервісу** — звичайні DB-транзакції (напр. Submit Assessment + lock відповіді — одна транзакція в Assessment Service, не розподілена сага).
- **Компенсація не потрібна для MVP-флоу**: Submit — фінальний і незворотний за дизайном (розділи 14–15 вимог), тому немає крос-сервісних відкатів підтверджених дій. Reopen (розділ 13) ініціюється Review Service через подію `ReviewReopened`; кожен сервіс сам вирішує, що скинути.

## 6. Тестування

- **Unit-тести** на бізнес-правила (BR-01…BR-15) у кожному сервісі; найвищий coverage — розрахунок Difference/Total/Grade Matrix у Results Service.
- **Contract-тести** між Gateway↔сервісами та producer↔consumer подій, за спільними TypeScript-типами з монорепо (`packages/shared`).
- **Integration-тести** кожного сервісу проти реальної Postgres-схеми (testcontainers).
- **E2E-тести** наскрізних сценаріїв через docker-compose стек: повний цикл Self→Lead→Compare→Share; ізоляція видимості (Employee не бачить Lead Assessment до Share, BR-11); RBAC-межі (Lead не бачить чужих співробітників, розділ 47).
- **Security-тести:** домен-рестрикція SSO (BR-02), спроби доступу поза контекстом, immutability після Submit (BR-09).

## 7. Технологічний стек

- **Backend:** NestJS (TypeScript) на кожен мікросервіс; спільні DTO/enum (Grade, EventTypes) у `packages/shared` монорепо.
- **Message broker:** RabbitMQ, topic exchange під типи подій.
- **DB:** PostgreSQL 16, схема на сервіс, міграції через Prisma/TypeORM per-service.
- **Frontend:** Next.js, рольові розділи UI (Employee/Lead/HR/Admin) з різним рівнем складності (розділ 46 вимог).
- **Gateway:** NestJS-based BFF з JWT-verification middleware.
- **CI/CD:** GitHub Actions (lint → unit → contract → build Docker images → push registry); окремий деплой-пайплайн під docker-compose.
- **Спостережуваність:** structured JSON-логи з кожного сервісу, окремо від бізнес Audit Log.

## 8. Що залишається відкритим (перенесено з розділу 51 вимог)

Наступні продуктові питання з вихідного документа (розділ 51) не є архітектурними блокерами, але мають бути закриті до фінального MVP-плану:

- Чи Evidence обов'язковий для Lead? Чи коментар обов'язковий при Difference ≥ 2?
- Хто має право Reopen review, і що саме відбувається після Reopen?
- Чи потрібне підтвердження співробітника після Share Result / можливість "I disagree"?
- Чи потрібен імпорт співробітників з CSV/Excel у MVP?
- Чи потрібен deadline для Self/Lead Assessment у MVP?
- Чи може employee мати більше одного Lead у межах одного review?

Ці питання впливають на деталі реалізації (наприклад, валідаційні правила в Assessment Service), тому мають бути уточнені на етапі writing-plans або перед стартом відповідного спринту.
