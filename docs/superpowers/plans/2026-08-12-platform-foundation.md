# Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working, testable monorepo skeleton (shared TypeScript package, one running NestJS service, Postgres + RabbitMQ via Docker Compose, and a CI pipeline) that every future microservice plan builds on top of.

**Architecture:** npm-workspaces monorepo with `packages/*` for shared code and `services/*` for independently deployable NestJS microservices. First service is the API Gateway, exposing only a health endpoint in this plan — later plans add routing/auth to it. Postgres and RabbitMQ run as Docker Compose services; the Gateway is containerized the same way every future service will be, establishing the pattern.

**Tech Stack:** Node.js 20 LTS, TypeScript 5 (strict mode), NestJS 10, Jest + Supertest, Docker / Docker Compose, PostgreSQL 16, RabbitMQ 3.13, GitHub Actions.

## Global Constraints

- Node.js 20 LTS everywhere (services, CI).
- TypeScript `strict: true` in every package/service.
- npm workspaces (not pnpm/yarn) — root `package.json` defines `workspaces: ["packages/*", "services/*"]`.
- Every service ships as its own Docker image; orchestration is Docker Compose, not Kubernetes.
- No service reaches into another service's database schema directly — only HTTP/events (not exercised yet in this plan, but the shared package must not encode any cross-service data access).
- Commit messages and any future PR text must never reference AI/Claude/Copilot or similar tooling.
- Dev-only secrets (Postgres/RabbitMQ passwords in `docker-compose.yml`) are placeholders; production secrets management is out of scope for this plan (tracked in the architecture design doc, section 4).

---

## File Structure

```
performance-management-platform/            (repo root, already exists)
├── package.json                            # root workspaces config
├── tsconfig.base.json                      # shared compiler options
├── docker-compose.yml                      # postgres + rabbitmq + gateway
├── .github/workflows/ci.yml                # lint/test/build on push+PR
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       ├── jest.config.js
│       └── src/
│           ├── index.ts
│           ├── grade/
│           │   ├── grade.enum.ts
│           │   └── grade.spec.ts
│           └── events/
│               ├── event-envelope.ts
│               └── event-envelope.spec.ts
└── services/
    └── gateway/
        ├── package.json
        ├── tsconfig.json
        ├── jest.config.js
        ├── Dockerfile
        ├── src/
        │   ├── main.ts
        │   ├── app.module.ts
        │   └── health/
        │       └── health.controller.ts
        └── test/
            ├── jest-e2e.json
            └── health.e2e-spec.ts
```

---

### Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: npm workspaces rooted at `packages/*` and `services/*`; any later task can add a folder under either and run `npm install` from the repo root to wire it in. `tsconfig.base.json` is extended by every package/service's own `tsconfig.json` via `"extends": "../../tsconfig.base.json"`.

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "performance-management-platform",
  "private": true,
  "workspaces": [
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 3: Install root dependencies and verify workspaces resolve**

Run: `npm install`
Expected: completes with no errors. `npm ls --workspaces` prints no output yet (no workspace packages exist), which is expected at this point — it should not error.

- [ ] **Step 4: Commit**

```bash
git checkout -b feature/foundation-skeleton
git add package.json tsconfig.base.json package-lock.json
git commit -m "chore: scaffold npm workspaces monorepo"
```

---

### Task 2: Shared package — `Grade` enum and numeric mapping

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/jest.config.js`
- Create: `packages/shared/src/grade/grade.enum.ts`
- Test: `packages/shared/src/grade/grade.spec.ts`
- Modify: `packages/shared/src/index.ts` (create, re-export)

**Interfaces:**
- Consumes: `tsconfig.base.json` (Task 1).
- Produces (from `@pmp/shared`): `enum Grade` with members `UNWILLING | JUNIOR | JUNIOR_PLUS | MIDDLE | MIDDLE_PLUS | SENIOR | LEAD`; `gradeToNumeric(grade: Grade): number`; `numericToGrade(value: number): Grade`. This is the canonical grade scale from the requirements doc (section 7) — every future service (Assessment, Results, Review) imports `Grade` from here instead of redefining it.

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@pmp/shared",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.4",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.16.0",
    "@typescript-eslint/eslint-plugin": "^7.16.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};
```

- [ ] **Step 4: Write the failing test — `packages/shared/src/grade/grade.spec.ts`**

```ts
import { Grade, gradeToNumeric, numericToGrade } from './grade.enum';

describe('gradeToNumeric', () => {
  it('maps each grade to its documented numeric value', () => {
    expect(gradeToNumeric(Grade.UNWILLING)).toBe(0);
    expect(gradeToNumeric(Grade.JUNIOR)).toBe(1);
    expect(gradeToNumeric(Grade.JUNIOR_PLUS)).toBe(2);
    expect(gradeToNumeric(Grade.MIDDLE)).toBe(3);
    expect(gradeToNumeric(Grade.MIDDLE_PLUS)).toBe(4);
    expect(gradeToNumeric(Grade.SENIOR)).toBe(5);
    expect(gradeToNumeric(Grade.LEAD)).toBe(6);
  });
});

describe('numericToGrade', () => {
  it('is the inverse of gradeToNumeric for every grade', () => {
    for (const grade of Object.values(Grade)) {
      expect(numericToGrade(gradeToNumeric(grade))).toBe(grade);
    }
  });

  it('throws for a numeric value with no matching grade', () => {
    expect(() => numericToGrade(99)).toThrow('No grade defined for numeric value 99');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test --workspace=@pmp/shared`
Expected: FAIL — `Cannot find module './grade.enum'`.

- [ ] **Step 6: Write the implementation — `packages/shared/src/grade/grade.enum.ts`**

```ts
export enum Grade {
  UNWILLING = 'UNWILLING',
  JUNIOR = 'JUNIOR',
  JUNIOR_PLUS = 'JUNIOR+',
  MIDDLE = 'MIDDLE',
  MIDDLE_PLUS = 'MIDDLE+',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
}

const GRADE_NUMERIC_VALUE: Record<Grade, number> = {
  [Grade.UNWILLING]: 0,
  [Grade.JUNIOR]: 1,
  [Grade.JUNIOR_PLUS]: 2,
  [Grade.MIDDLE]: 3,
  [Grade.MIDDLE_PLUS]: 4,
  [Grade.SENIOR]: 5,
  [Grade.LEAD]: 6,
};

export function gradeToNumeric(grade: Grade): number {
  return GRADE_NUMERIC_VALUE[grade];
}

export function numericToGrade(value: number): Grade {
  const match = (Object.entries(GRADE_NUMERIC_VALUE) as [Grade, number][]).find(
    ([, numeric]) => numeric === value,
  );
  if (!match) {
    throw new Error(`No grade defined for numeric value ${value}`);
  }
  return match[0];
}
```

- [ ] **Step 7: Create `packages/shared/src/index.ts`**

```ts
export * from './grade/grade.enum';
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test --workspace=@pmp/shared`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add Grade enum with numeric mapping"
```

---

### Task 3: Shared package — event envelope for the outbox pattern

**Files:**
- Create: `packages/shared/src/events/event-envelope.ts`
- Test: `packages/shared/src/events/event-envelope.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nothing new (same package as Task 2).
- Produces (from `@pmp/shared`): `interface EventEnvelope<TPayload>` with fields `eventId: string`, `eventType: string`, `occurredAt: string` (ISO-8601), `payload: TPayload`; and `createEventEnvelope<TPayload>(eventType: string, payload: TPayload, idGenerator?: () => string): EventEnvelope<TPayload>`. Every future service publishing a domain event (e.g. `AssessmentSubmitted`, `ResultShared`) wraps its payload with this envelope before writing to its outbox table — this is the shape the Audit Service and Notification Service will deserialize.

- [ ] **Step 1: Write the failing test — `packages/shared/src/events/event-envelope.spec.ts`**

```ts
import { createEventEnvelope } from './event-envelope';

describe('createEventEnvelope', () => {
  it('wraps a payload with eventId, eventType, occurredAt, and the payload itself', () => {
    const envelope = createEventEnvelope(
      'AssessmentSubmitted',
      { reviewId: 'r-1', userId: 'u-1' },
      () => 'fixed-id',
    );

    expect(envelope).toEqual({
      eventId: 'fixed-id',
      eventType: 'AssessmentSubmitted',
      occurredAt: envelope.occurredAt,
      payload: { reviewId: 'r-1', userId: 'u-1' },
    });
  });

  it('produces a parseable ISO-8601 timestamp', () => {
    const envelope = createEventEnvelope('AssessmentSubmitted', {}, () => 'fixed-id');

    expect(Number.isNaN(Date.parse(envelope.occurredAt))).toBe(false);
  });

  it('defaults to a random eventId when no generator is supplied', () => {
    const first = createEventEnvelope('AssessmentSubmitted', {});
    const second = createEventEnvelope('AssessmentSubmitted', {});

    expect(first.eventId).not.toBe(second.eventId);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@pmp/shared`
Expected: FAIL — `Cannot find module './event-envelope'`.

- [ ] **Step 3: Write the implementation — `packages/shared/src/events/event-envelope.ts`**

```ts
import { randomUUID } from 'crypto';

export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: TPayload;
}

export function createEventEnvelope<TPayload>(
  eventType: string,
  payload: TPayload,
  idGenerator: () => string = randomUUID,
): EventEnvelope<TPayload> {
  return {
    eventId: idGenerator(),
    eventType,
    occurredAt: new Date().toISOString(),
    payload,
  };
}
```

- [ ] **Step 4: Update `packages/shared/src/index.ts`**

```ts
export * from './grade/grade.enum';
export * from './events/event-envelope';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@pmp/shared`
Expected: PASS (3 tests in this file, 6 total in the package).

- [ ] **Step 6: Build the shared package to confirm it compiles cleanly**

Run: `npm run build --workspace=@pmp/shared`
Expected: succeeds, produces `packages/shared/dist/index.js` and `.d.ts` files.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add event envelope helper for the outbox pattern"
```

---

### Task 4: Gateway service — NestJS skeleton with a health endpoint

**Files:**
- Create: `services/gateway/package.json`
- Create: `services/gateway/tsconfig.json`
- Create: `services/gateway/src/main.ts`
- Create: `services/gateway/src/app.module.ts`
- Create: `services/gateway/src/health/health.controller.ts`
- Create: `services/gateway/test/jest-e2e.json`
- Test: `services/gateway/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` (Task 1). Does not yet depend on `@pmp/shared` — that wiring starts in the Auth Service plan, when the gateway needs `EventEnvelope`/domain types.
- Produces: a running NestJS app (`AppModule`) listening on `process.env.PORT ?? 3000`, exposing `GET /health` → `{ status: 'ok' }`. Later plans (Auth Service) add controllers/middleware to this same `AppModule` — this task is the base every gateway feature attaches to.

- [ ] **Step 1: Create `services/gateway/package.json`**

```json
{
  "name": "@pmp/gateway",
  "version": "0.1.0",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.1",
    "@nestjs/core": "^10.4.1",
    "@nestjs/platform-express": "^10.4.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/testing": "^10.4.1",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.4",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Create `services/gateway/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `services/gateway/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 4: Write the failing e2e test — `services/gateway/test/health.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) returns status ok', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });
});
```

- [ ] **Step 5: Install gateway dependencies and run the test to verify it fails**

Run: `npm install && npm run test:e2e --workspace=@pmp/gateway`
Expected: FAIL — `Cannot find module '../src/app.module'`.

- [ ] **Step 6: Write the implementation — `services/gateway/src/health/health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 7: Write `services/gateway/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 8: Write `services/gateway/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/gateway`
Expected: PASS (1 test).

- [ ] **Step 10: Build the gateway to confirm it compiles cleanly**

Run: `npm run build --workspace=@pmp/gateway`
Expected: succeeds, produces `services/gateway/dist/main.js`.

- [ ] **Step 11: Commit**

```bash
git add services/gateway
git commit -m "feat(gateway): add NestJS skeleton with health endpoint"
```

---

### Task 5: Containerize the stack — Dockerfile + Docker Compose

**Files:**
- Create: `services/gateway/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `@pmp/shared` build output and `@pmp/gateway` build output (Tasks 2–4).
- Produces: `docker-compose.yml` with three services — `postgres` (port 5432), `rabbitmq` (ports 5672/15672), `gateway` (port 3000, depends on both being healthy). Every future service plan adds its own service block to this same file plus its own `Dockerfile` following the pattern established here.

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
**/node_modules
**/dist
.git
docs
```

- [ ] **Step 2: Create `services/gateway/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY services/gateway ./services/gateway
RUN npm ci
RUN npm run build --workspace=@pmp/shared
RUN npm run build --workspace=@pmp/gateway

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/services/gateway/dist ./services/gateway/dist
COPY --from=build /app/services/gateway/package.json ./services/gateway/package.json
EXPOSE 3000
CMD ["node", "services/gateway/dist/main.js"]
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: pmp
      POSTGRES_PASSWORD: pmp_dev_password
      POSTGRES_DB: pmp
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pmp"]
      interval: 5s
      timeout: 5s
      retries: 10

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: pmp
      RABBITMQ_DEFAULT_PASS: pmp_dev_password
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  gateway:
    build:
      context: .
      dockerfile: services/gateway/Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy

volumes:
  postgres_data:
```

- [ ] **Step 4: Build and start the stack**

Run: `docker compose up --build -d`
Expected: three containers start; `docker compose ps` shows `postgres` and `rabbitmq` as `healthy` and `gateway` as `running`.

- [ ] **Step 5: Verify the gateway health endpoint through the container**

Run: `curl -sf http://localhost:3000/health`
Expected: `{"status":"ok"}`.

- [ ] **Step 6: Tear down**

Run: `docker compose down -v`
Expected: containers and the `postgres_data` volume are removed cleanly.

- [ ] **Step 7: Commit**

```bash
git add services/gateway/Dockerfile docker-compose.yml .dockerignore
git commit -m "feat(infra): containerize gateway and add docker-compose stack"
```

---

### Task 6: CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root `npm run lint|test|build` scripts (Task 1), which fan out to every workspace via `--workspaces --if-present`.
- Produces: a GitHub Actions workflow named `CI` that runs on every push to `main` and every pull request. Future service plans don't need to touch this file — adding a workspace under `packages/*` or `services/*` with `lint`/`test`/`build` npm scripts is picked up automatically.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint --workspaces --if-present
      - run: npm run test --workspaces --if-present
      - run: npm run build --workspaces --if-present
```

- [ ] **Step 2: Validate the workflow file locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no output, exit code 0 (valid YAML).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(ci): add lint/test/build pipeline"
```

- [ ] **Step 4: Push the branch and confirm the workflow runs**

Run: `git push -u origin feature/foundation-skeleton`
Then check the run: `gh run list --branch feature/foundation-skeleton --limit 1`
Expected: a run appears with status `completed` / conclusion `success`. If it fails, open the run (`gh run view --log-failed`) and fix before opening the PR.

---

## Self-Review Notes

- **Spec coverage:** This plan implements the infrastructure prerequisites named in the architecture design doc §3 (monorepo, one service running in Docker, Postgres/RabbitMQ present, CI) and §7 (tech stack). It intentionally does **not** implement Auth, Org, or any business logic — those are separate plans per the phase list agreed with the user.
- **Placeholder scan:** no TBD/TODO; every step has concrete file content or an exact command with expected output.
- **Type consistency:** `Grade` (Task 2) and `EventEnvelope`/`createEventEnvelope` (Task 3) are the only public exports of `@pmp/shared` introduced here, both re-exported from `packages/shared/src/index.ts`; later plans importing `@pmp/shared` should use these exact names.
- **Scope check:** single, independently testable subsystem (buildable, deployable skeleton) — no further decomposition needed.
