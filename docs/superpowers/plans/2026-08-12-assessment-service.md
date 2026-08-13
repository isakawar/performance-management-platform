# Assessment Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `services/assessment` (Questionnaire Builder + Self/Lead Assessment) and a minimal Gateway reverse-proxy layer, so the backend half of the Assessment Demo Slice is independently testable via its own API before any UI exists.

**Architecture:** New `services/assessment` NestJS microservice, own `assessment` Postgres schema, verifies JWTs itself (same pattern as Gateway/Auth — no role claims required, no role guard, since the design explicitly has no RBAC in this slice). `Framework → Category → Competency → CompetencyGradeExpectation` form the builder; `Questionnaire` references a `Framework` (one mutable version, no snapshots); `Review` spawns two `Assessment` rows (SELF/LEAD) identified by free-text `employeeEmail`/`leadEmail`; `AssessmentAnswer` rows hold per-competency grades, gated by an ownership+both-submitted isolation rule. Gateway gets a thin Express reverse-proxy (`/api/auth/*` → Auth Service, `/api/assessment/*` → Assessment Service, `/api` prefix stripped, rest forwarded as-is) mounted ahead of Nest's own routing/guards — downstream services authenticate themselves, the proxy doesn't.

**Tech Stack:** NestJS 10, `@nestjs/jwt`, `@nestjs/typeorm` + TypeORM 0.3 + `pg`, `testcontainers`/`@testcontainers/postgresql`, `http-proxy-middleware` (Gateway only), Jest + Supertest, Docker / Docker Compose.

## Global Constraints

- Node.js 20 LTS everywhere; TypeScript `strict: true`; `services/assessment` sets `strictPropertyInitialization: false` and `useDefineForClassFields: false` (same TypeORM-decorator accommodation as `services/auth`/the `services/org` draft).
- npm workspaces — `services/assessment` is a new workspace under `services/*`.
- No top-level `schema:` option on any `TypeOrmModule.forRoot(...)` — this combined with `migrationsRun: true` breaks against a fresh database (`QueryFailedError: schema "assessment" does not exist`, discovered and fixed twice already in this repo). Each entity carries its own `@Entity({ schema: 'assessment' })` instead.
- `JWT_SECRET` must be identical across `services/auth`, `services/gateway`, and `services/assessment`. Reuse the exact fail-closed-in-production pattern already established: `requireJwtSecret()` throws when unset and `NODE_ENV === 'production'`, dev fallback (`'dev-secret-change-me'`) otherwise.
- Commit messages, PR titles/bodies, and code comments must never reference AI/Claude/Copilot or similar tooling — hard repo rule. Every implementer dispatch must verify with `git log -1 --format=%B` after every commit and amend immediately if attribution slipped in (this has happened before in this repo).
- **No dependency on `services/org`.** It does not exist in the codebase yet (its plan is written but unexecuted). `employeeEmail`/`leadEmail` are plain strings compared against `request.user.email`; the JWT carries only `{ sub, email }` — no roles.
- **No role-based access control in this service.** Every authenticated (`@racoongang.com`, via the existing Auth Service) user can create frameworks, questionnaires, and reviews, and can act as employee or lead on any review — matches the approved design's explicit scope boundary.
- Path convention for the Gateway proxy: strip only the `/api` prefix, forward the rest unchanged. Auth Service already exposes routes under `/auth/*` (its `AuthController` is `@Controller('auth')`), so `/api/auth/google` → `AUTH_SERVICE_URL/auth/google` needs no further rewriting. Assessment Service therefore sets a global route prefix of `assessment` (excluding `health`) so its externally-proxied routes are `/assessment/frameworks`, `/assessment/reviews`, etc., matching `/api/assessment/frameworks` after the `/api` strip.

---

## File Structure

```
services/assessment/
├── package.json
├── tsconfig.json
├── jest.config.js
├── Dockerfile
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── health/
│   │   └── health.controller.ts
│   ├── auth/
│   │   ├── jwt-auth.guard.ts
│   │   └── express.d.ts
│   ├── framework/
│   │   ├── framework.entity.ts
│   │   ├── category.entity.ts
│   │   ├── competency.entity.ts
│   │   ├── competency-grade-expectation.entity.ts
│   │   ├── framework.repository.ts
│   │   ├── framework.controller.ts
│   │   └── framework.dto.ts
│   ├── questionnaire/
│   │   ├── questionnaire.entity.ts
│   │   ├── questionnaire.repository.ts
│   │   ├── questionnaire.controller.ts
│   │   └── questionnaire.dto.ts
│   ├── review/
│   │   ├── review.entity.ts
│   │   ├── assessment.entity.ts
│   │   ├── review.repository.ts
│   │   ├── review.controller.ts
│   │   └── review.dto.ts
│   ├── assessment-answer/
│   │   ├── assessment-answer.entity.ts
│   │   ├── assessment-answer.repository.ts
│   │   ├── assessment.controller.ts
│   │   └── assessment-answer.dto.ts
│   └── database/
│       └── migrations/
│           ├── 1723600000000-create-framework.ts
│           ├── 1723610000000-create-questionnaire.ts
│           ├── 1723620000000-create-review.ts
│           └── 1723630000000-create-assessment-answer.ts
└── test/
    ├── jest-e2e.json
    ├── health.e2e-spec.ts
    ├── framework.e2e-spec.ts
    ├── questionnaire.repository.integration-spec.ts
    ├── review.e2e-spec.ts
    └── assessment-answer.e2e-spec.ts

services/gateway/src/proxy/
└── register-service-proxies.ts
services/gateway/src/main.ts       # modified
services/gateway/test/proxy.e2e-spec.ts

docker-compose.yml   # modified
```

---

### Task 1: Assessment Service scaffolding with a health endpoint

**Files:**
- Create: `services/assessment/package.json`, `tsconfig.json`, `jest.config.js`
- Create: `services/assessment/src/main.ts`, `src/app.module.ts`
- Create: `services/assessment/src/health/health.controller.ts`
- Create: `services/assessment/test/jest-e2e.json`
- Test: `services/assessment/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: NestJS app listening on `process.env.PORT ?? 3003`, global prefix `assessment` (health excluded), `GET /health` → `{ status: 'ok' }` (unprefixed, for Docker healthchecks). Every later task adds to this `AppModule`.

- [ ] **Step 1: `services/assessment/package.json`**

```json
{
  "name": "@pmp/assessment",
  "version": "0.1.0",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "test": "jest --passWithNoTests",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint src test --ext .ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.1",
    "@nestjs/core": "^10.4.1",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/platform-express": "^10.4.1",
    "@nestjs/typeorm": "^10.0.2",
    "@pmp/shared": "^0.1.0",
    "pg": "^8.12.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/testing": "^10.4.1",
    "@testcontainers/postgresql": "^10.13.1",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/parser": "^7.16.0",
    "@typescript-eslint/eslint-plugin": "^7.16.0",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "testcontainers": "^10.13.1",
    "ts-jest": "^29.2.4",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: `services/assessment/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "strictPropertyInitialization": false,
    "useDefineForClassFields": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `services/assessment/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};
```

- [ ] **Step 4: `services/assessment/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": "(\\.e2e-spec\\.ts|\\.integration-spec\\.ts)$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 5: Write the failing e2e test — `services/assessment/test/health.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('assessment', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) returns status ok, unprefixed', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Install dependencies, run the test to verify it fails**

Run: `npm install && npm run test:e2e --workspace=@pmp/assessment`
Expected: FAIL — `Cannot find module '../src/app.module'`.

- [ ] **Step 7: `services/assessment/src/health/health.controller.ts`**

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

- [ ] **Step 8: `services/assessment/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 9: `services/assessment/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('assessment', { exclude: ['health'] });
  await app.listen(process.env.PORT ?? 3003);
}

bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: PASS (1 test).

- [ ] **Step 11: Commit**

```bash
git checkout -b feature/assessment-service
git add services/assessment package-lock.json
git commit -m "feat(assessment): add NestJS skeleton with health endpoint"
```

---

### Task 2: JWT auth guard

**Files:**
- Create: `services/assessment/src/auth/jwt-auth.guard.ts`
- Test: `services/assessment/src/auth/jwt-auth.guard.spec.ts`
- Create: `services/assessment/src/auth/express.d.ts`
- Modify: `services/assessment/src/app.module.ts`

**Interfaces:**
- Produces: `JwtAuthGuard` (verifies `Authorization: Bearer <token>`, attaches decoded `AccessTokenPayload` — `{ sub, email }` from `@pmp/shared` — to `request.user`, throws `UnauthorizedException` on anything malformed). Applied per-controller via `@UseGuards(JwtAuthGuard)` (not global — `/health` stays unguarded with no extra decorator needed). Every controller from Task 3 onward uses this.

- [ ] **Step 1: Write the failing unit test — `services/assessment/src/auth/jwt-auth.guard.spec.ts`**

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request = { headers };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [JwtAuthGuard],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
    jwtService = moduleRef.get(JwtService);
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', () => {
    expect(() => guard.canActivate(makeContext({ authorization: 'Bearer not-a-token' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows a valid token and attaches the payload to request.user', () => {
    const token = jwtService.sign({ sub: 'u1', email: 'qa1@racoongang.com' });
    const context = makeContext({ authorization: `Bearer ${token}` });

    expect(guard.canActivate(context)).toBe(true);
    expect(context.switchToHttp().getRequest().user).toMatchObject({ sub: 'u1', email: 'qa1@racoongang.com' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=@pmp/assessment`
Expected: FAIL — `Cannot find module './jwt-auth.guard'`.

- [ ] **Step 3: `services/assessment/src/auth/jwt-auth.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from '@pmp/shared';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token);
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        throw new Error('Malformed access token payload');
      }
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }
}
```

Note: at the time this plan was written, `@pmp/shared`'s `AccessTokenPayload` is `{ sub: string; email: string }` (the `services/org` draft plan would add a `roles` field, but that plan is unexecuted — if it lands first, this guard's `typeof payload.sub`/`typeof payload.email` checks remain valid either way since they only check the two fields this service actually uses).

- [ ] **Step 4: `services/assessment/src/auth/express.d.ts`**

```ts
import { AccessTokenPayload } from '@pmp/shared';

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}
```

- [ ] **Step 5: Update `services/assessment/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './health/health.controller';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-secret-change-me';
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.register({
      secret: requireJwtSecret(),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 6: Run unit tests and build**

Run: `npm test --workspace=@pmp/assessment && npm run build --workspace=@pmp/assessment`
Expected: PASS (3 tests); build succeeds.

- [ ] **Step 7: Commit**

```bash
git add services/assessment/src/auth services/assessment/src/app.module.ts
git commit -m "feat(assessment): add JWT auth guard"
```

---

### Task 3: Questionnaire Builder — Framework, Category, Competency, CompetencyGradeExpectation

**Files:**
- Create: `services/assessment/src/framework/framework.entity.ts`, `category.entity.ts`, `competency.entity.ts`, `competency-grade-expectation.entity.ts`
- Create: `services/assessment/src/framework/framework.repository.ts`
- Create: `services/assessment/src/framework/framework.dto.ts`
- Create: `services/assessment/src/framework/framework.controller.ts`
- Create: `services/assessment/src/database/migrations/1723600000000-create-framework.ts`
- Test: `services/assessment/test/framework.e2e-spec.ts`
- Modify: `services/assessment/src/app.module.ts`

**Interfaces:**
- Produces: `FrameworkEntity` (`org.frameworks`... no — table `assessment.frameworks`: `id, name` unique, `createdAt`), `CategoryEntity` (`assessment.categories`: `id, frameworkId, name, orderIndex`), `CompetencyEntity` (`assessment.competencies`: `id, categoryId, name, description, weight numeric`), `CompetencyGradeExpectationEntity` (`assessment.competency_grade_expectations`: `id, competencyId, grade varchar, description`). `FrameworkRepository` with `create`, `findAll`, `findByIdWithStructure(id): Promise<FrameworkWithStructure | null>` (nested categories→competencies→gradeExpectations), `addCategory`, `addCompetency`. Task 4's `QuestionnaireRepository` calls `findByIdWithStructure` to validate a `frameworkId` exists and to serve the nested structure for the frontend's assessment form.

- [ ] **Step 1: Migration — `services/assessment/src/database/migrations/1723600000000-create-framework.ts`**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFramework1723600000000 implements MigrationInterface {
  name = 'CreateFramework1723600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "assessment"`);
    await queryRunner.query(`
      CREATE TABLE "assessment"."frameworks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "framework_id" uuid NOT NULL REFERENCES "assessment"."frameworks"("id"),
        "name" varchar NOT NULL,
        "order_index" int NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."competencies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL REFERENCES "assessment"."categories"("id"),
        "name" varchar NOT NULL,
        "description" varchar,
        "weight" numeric NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."competency_grade_expectations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "competency_id" uuid NOT NULL REFERENCES "assessment"."competencies"("id"),
        "grade" varchar NOT NULL,
        "description" varchar NOT NULL,
        UNIQUE ("competency_id", "grade")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."competency_grade_expectations"`);
    await queryRunner.query(`DROP TABLE "assessment"."competencies"`);
    await queryRunner.query(`DROP TABLE "assessment"."categories"`);
    await queryRunner.query(`DROP TABLE "assessment"."frameworks"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "assessment" CASCADE`);
  }
}
```

- [ ] **Step 2: Entities**

`services/assessment/src/framework/framework.entity.ts`
```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'frameworks', schema: 'assessment' })
export class FrameworkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

`services/assessment/src/framework/category.entity.ts`
```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'categories', schema: 'assessment' })
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'framework_id' })
  frameworkId: string;

  @Column()
  name: string;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;
}
```

`services/assessment/src/framework/competency.entity.ts`
```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'competencies', schema: 'assessment' })
export class CompetencyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string | null;

  @Column({ type: 'numeric', default: 1 })
  weight: number;
}
```

`services/assessment/src/framework/competency-grade-expectation.entity.ts`
```ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'competency_grade_expectations', schema: 'assessment' })
@Unique(['competencyId', 'grade'])
export class CompetencyGradeExpectationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @Column()
  grade: string;

  @Column()
  description: string;
}
```

- [ ] **Step 3: `services/assessment/src/framework/framework.dto.ts`**

```ts
import { BadRequestException } from '@nestjs/common';

export interface CreateFrameworkDto {
  name: string;
}
export function parseCreateFrameworkDto(body: unknown): CreateFrameworkDto {
  const name = (body as Partial<CreateFrameworkDto> | undefined)?.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  return { name: name.trim() };
}

export interface CreateCategoryDto {
  name: string;
  orderIndex: number;
}
export function parseCreateCategoryDto(body: unknown): CreateCategoryDto {
  const candidate = body as Partial<CreateCategoryDto> | undefined;
  if (typeof candidate?.name !== 'string' || candidate.name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  const orderIndex = typeof candidate.orderIndex === 'number' ? candidate.orderIndex : 0;
  return { name: candidate.name.trim(), orderIndex };
}

export interface GradeExpectationInput {
  grade: string;
  description: string;
}
export interface CreateCompetencyDto {
  name: string;
  description?: string;
  weight: number;
  gradeExpectations: GradeExpectationInput[];
}
export function parseCreateCompetencyDto(body: unknown): CreateCompetencyDto {
  const candidate = body as Partial<CreateCompetencyDto> | undefined;
  if (typeof candidate?.name !== 'string' || candidate.name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  const weight = typeof candidate.weight === 'number' ? candidate.weight : 1;
  const gradeExpectations = Array.isArray(candidate.gradeExpectations)
    ? candidate.gradeExpectations.filter(
        (entry): entry is GradeExpectationInput =>
          typeof entry?.grade === 'string' && typeof entry?.description === 'string',
      )
    : [];
  return {
    name: candidate.name.trim(),
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    weight,
    gradeExpectations,
  };
}
```

- [ ] **Step 4: `services/assessment/src/framework/framework.repository.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrameworkEntity } from './framework.entity';
import { CategoryEntity } from './category.entity';
import { CompetencyEntity } from './competency.entity';
import { CompetencyGradeExpectationEntity } from './competency-grade-expectation.entity';
import { GradeExpectationInput } from './framework.dto';

export interface FrameworkWithStructure extends FrameworkEntity {
  categories: (CategoryEntity & {
    competencies: (CompetencyEntity & { gradeExpectations: CompetencyGradeExpectationEntity[] })[];
  })[];
}

@Injectable()
export class FrameworkRepository {
  constructor(
    @InjectRepository(FrameworkEntity) private readonly frameworks: Repository<FrameworkEntity>,
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(CompetencyEntity) private readonly competencies: Repository<CompetencyEntity>,
    @InjectRepository(CompetencyGradeExpectationEntity)
    private readonly gradeExpectations: Repository<CompetencyGradeExpectationEntity>,
  ) {}

  findAll(): Promise<FrameworkEntity[]> {
    return this.frameworks.find({ order: { name: 'ASC' } });
  }

  create(name: string): Promise<FrameworkEntity> {
    return this.frameworks.save(this.frameworks.create({ name }));
  }

  async addCategory(frameworkId: string, name: string, orderIndex: number): Promise<CategoryEntity> {
    const framework = await this.frameworks.findOne({ where: { id: frameworkId } });
    if (!framework) {
      throw new NotFoundException(`Framework ${frameworkId} not found`);
    }
    return this.categories.save(this.categories.create({ frameworkId, name, orderIndex }));
  }

  async addCompetency(
    categoryId: string,
    name: string,
    description: string | undefined,
    weight: number,
    gradeExpectations: GradeExpectationInput[],
  ): Promise<CompetencyEntity> {
    const category = await this.categories.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
    const competency = await this.competencies.save(
      this.competencies.create({ categoryId, name, description: description ?? null, weight }),
    );
    if (gradeExpectations.length > 0) {
      await this.gradeExpectations.save(
        gradeExpectations.map((entry) =>
          this.gradeExpectations.create({ competencyId: competency.id, grade: entry.grade, description: entry.description }),
        ),
      );
    }
    return competency;
  }

  async findByIdWithStructure(id: string): Promise<FrameworkWithStructure | null> {
    const framework = await this.frameworks.findOne({ where: { id } });
    if (!framework) {
      return null;
    }
    const categories = await this.categories.find({ where: { frameworkId: id }, order: { orderIndex: 'ASC' } });
    const categoriesWithCompetencies = await Promise.all(
      categories.map(async (category) => {
        const competencies = await this.competencies.find({ where: { categoryId: category.id } });
        const competenciesWithGrades = await Promise.all(
          competencies.map(async (competency) => {
            const grades = await this.gradeExpectations.find({ where: { competencyId: competency.id } });
            return { ...competency, gradeExpectations: grades };
          }),
        );
        return { ...category, competencies: competenciesWithGrades };
      }),
    );
    return { ...framework, categories: categoriesWithCompetencies };
  }
}
```

- [ ] **Step 5: `services/assessment/src/framework/framework.controller.ts`**

```ts
import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FrameworkEntity } from './framework.entity';
import { CategoryEntity } from './category.entity';
import { CompetencyEntity } from './competency.entity';
import { FrameworkRepository, FrameworkWithStructure } from './framework.repository';
import { parseCreateCategoryDto, parseCreateCompetencyDto, parseCreateFrameworkDto } from './framework.dto';

@UseGuards(JwtAuthGuard)
@Controller('frameworks')
export class FrameworkController {
  constructor(private readonly frameworks: FrameworkRepository) {}

  @Get()
  list(): Promise<FrameworkEntity[]> {
    return this.frameworks.findAll();
  }

  @Post()
  create(@Body() body: unknown): Promise<FrameworkEntity> {
    const dto = parseCreateFrameworkDto(body);
    return this.frameworks.create(dto.name);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<FrameworkWithStructure> {
    const framework = await this.frameworks.findByIdWithStructure(id);
    if (!framework) {
      throw new NotFoundException(`Framework ${id} not found`);
    }
    return framework;
  }

  @Post(':id/categories')
  createCategory(@Param('id') id: string, @Body() body: unknown): Promise<CategoryEntity> {
    const dto = parseCreateCategoryDto(body);
    return this.frameworks.addCategory(id, dto.name, dto.orderIndex);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly frameworks: FrameworkRepository) {}

  @Post(':id/competencies')
  createCompetency(@Param('id') id: string, @Body() body: unknown): Promise<CompetencyEntity> {
    const dto = parseCreateCompetencyDto(body);
    return this.frameworks.addCompetency(id, dto.name, dto.description, dto.weight, dto.gradeExpectations);
  }
}
```

- [ ] **Step 6: Write the failing e2e test — `services/assessment/test/framework.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { HealthController } from '../src/health/health.controller';
import { FrameworkEntity } from '../src/framework/framework.entity';
import { CategoryEntity } from '../src/framework/category.entity';
import { CompetencyEntity } from '../src/framework/competency.entity';
import { CompetencyGradeExpectationEntity } from '../src/framework/competency-grade-expectation.entity';
import { FrameworkRepository } from '../src/framework/framework.repository';
import { FrameworkController, CategoryController } from '../src/framework/framework.controller';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';

describe('FrameworkController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let token: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity],
          migrations: [CreateFramework1723600000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity]),
      ],
      controllers: [HealthController, FrameworkController, CategoryController],
      providers: [FrameworkRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    token = moduleFixture.get(JwtService).sign({ sub: 'u1', email: 'qa1@racoongang.com' });
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('rejects listing frameworks without a token', () => {
    return request(app.getHttpServer()).get('/frameworks').expect(401);
  });

  it('builds a framework end to end: create, add category, add competency with grade expectations, fetch nested', async () => {
    const framework = await request(app.getHttpServer())
      .post('/frameworks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'QA Performance Profile' })
      .expect(201);

    const category = await request(app.getHttpServer())
      .post(`/frameworks/${framework.body.id}/categories`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hard Skills', orderIndex: 0 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/categories/${category.body.id}/competencies`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Planning',
        description: 'Ability to plan testing',
        weight: 2,
        gradeExpectations: [
          { grade: 'JUNIOR', description: 'Basic level' },
          { grade: 'SENIOR', description: 'Expert level' },
        ],
      })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/frameworks/${framework.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fetched.body.categories).toHaveLength(1);
    expect(fetched.body.categories[0].competencies).toHaveLength(1);
    expect(fetched.body.categories[0].competencies[0].gradeExpectations).toHaveLength(2);
  });
}, 60000);
```

- [ ] **Step 7: Run to verify it fails, then passes**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: fails until all Steps 1–5 exist, then PASSES (3 tests: Task 1's health spec plus these 2).

- [ ] **Step 8: Update `services/assessment/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { FrameworkController, CategoryController } from './framework/framework.controller';
import { FrameworkEntity } from './framework/framework.entity';
import { CategoryEntity } from './framework/category.entity';
import { CompetencyEntity } from './framework/competency.entity';
import { CompetencyGradeExpectationEntity } from './framework/competency-grade-expectation.entity';
import { FrameworkRepository } from './framework/framework.repository';
import { CreateFramework1723600000000 } from './database/migrations/1723600000000-create-framework';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-secret-change-me';
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.register({
      secret: requireJwtSecret(),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://pmp:pmp_dev_password@localhost:5432/pmp',
      entities: [FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity],
      migrations: [CreateFramework1723600000000],
      migrationsRun: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity]),
  ],
  controllers: [HealthController, FrameworkController, CategoryController],
  providers: [FrameworkRepository],
})
export class AppModule {}
```

- [ ] **Step 9: Rebuild and rerun**

Run: `npm run build --workspace=@pmp/assessment && npm run test:e2e --workspace=@pmp/assessment`
Expected: both succeed.

- [ ] **Step 10: Commit**

```bash
git add services/assessment
git commit -m "feat(assessment): add Questionnaire Builder entities and endpoints"
```

---

### Task 4: Questionnaire

**Files:**
- Create: `services/assessment/src/questionnaire/questionnaire.entity.ts`, `questionnaire.repository.ts`, `questionnaire.controller.ts`, `questionnaire.dto.ts`
- Create: `services/assessment/src/database/migrations/1723610000000-create-questionnaire.ts`
- Test: `services/assessment/test/questionnaire.repository.integration-spec.ts`
- Modify: `services/assessment/src/app.module.ts`

**Interfaces:**
- Consumes: `FrameworkRepository.findByIdWithStructure` (Task 3) to validate `frameworkId` and to serve the nested structure.
- Produces: `QuestionnaireEntity` (`assessment.questionnaires`: `id, name, direction, frameworkId, createdAt`), `QuestionnaireRepository.create(name, direction, frameworkId)`, `.findAll()`, `.findByIdWithFramework(id)`. Task 5's `ReviewRepository` validates `questionnaireId` via `.findById`.

- [ ] **Step 1: Migration — `services/assessment/src/database/migrations/1723610000000-create-questionnaire.ts`**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionnaire1723610000000 implements MigrationInterface {
  name = 'CreateQuestionnaire1723610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment"."questionnaires" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "direction" varchar NOT NULL,
        "framework_id" uuid NOT NULL REFERENCES "assessment"."frameworks"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."questionnaires"`);
  }
}
```

- [ ] **Step 2: `services/assessment/src/questionnaire/questionnaire.entity.ts`**

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'questionnaires', schema: 'assessment' })
export class QuestionnaireEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  direction: string;

  @Column({ name: 'framework_id' })
  frameworkId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 3: `services/assessment/src/questionnaire/questionnaire.dto.ts`**

```ts
import { BadRequestException } from '@nestjs/common';

export interface CreateQuestionnaireDto {
  name: string;
  direction: string;
  frameworkId: string;
}
export function parseCreateQuestionnaireDto(body: unknown): CreateQuestionnaireDto {
  const candidate = body as Partial<CreateQuestionnaireDto> | undefined;
  if (typeof candidate?.name !== 'string' || candidate.name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  if (typeof candidate?.direction !== 'string' || candidate.direction.trim().length === 0) {
    throw new BadRequestException('direction is required');
  }
  if (typeof candidate?.frameworkId !== 'string' || candidate.frameworkId.length === 0) {
    throw new BadRequestException('frameworkId is required');
  }
  return { name: candidate.name.trim(), direction: candidate.direction.trim(), frameworkId: candidate.frameworkId };
}
```

- [ ] **Step 4: Write the failing integration test — `services/assessment/test/questionnaire.repository.integration-spec.ts`**

```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { FrameworkEntity } from '../src/framework/framework.entity';
import { CategoryEntity } from '../src/framework/category.entity';
import { CompetencyEntity } from '../src/framework/competency.entity';
import { CompetencyGradeExpectationEntity } from '../src/framework/competency-grade-expectation.entity';
import { FrameworkRepository } from '../src/framework/framework.repository';
import { QuestionnaireEntity } from '../src/questionnaire/questionnaire.entity';
import { QuestionnaireRepository } from '../src/questionnaire/questionnaire.repository';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from '../src/database/migrations/1723610000000-create-questionnaire';

describe('QuestionnaireRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let frameworks: FrameworkRepository;
  let questionnaires: QuestionnaireRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity, QuestionnaireEntity],
          migrations: [CreateFramework1723600000000, CreateQuestionnaire1723610000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity, QuestionnaireEntity]),
      ],
      providers: [FrameworkRepository, QuestionnaireRepository],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    frameworks = moduleRef.get(FrameworkRepository);
    questionnaires = moduleRef.get(QuestionnaireRepository);
  }, 60000);

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('creates a questionnaire referencing an existing framework', async () => {
    const framework = await frameworks.create('QA Performance Profile');
    const questionnaire = await questionnaires.create('Q1 2026 QA Review', 'QA', framework.id);

    expect(questionnaire.frameworkId).toBe(framework.id);
  });

  it('rejects creating a questionnaire for a nonexistent framework', async () => {
    await expect(questionnaires.create('Bad', 'QA', 'not-a-real-id')).rejects.toThrow(NotFoundException);
  });

  it('findByIdWithFramework returns the nested framework structure', async () => {
    const framework = await frameworks.create('AQA Performance Profile');
    const questionnaire = await questionnaires.create('Q1 2026 AQA Review', 'AQA', framework.id);

    const found = await questionnaires.findByIdWithFramework(questionnaire.id);

    expect(found?.framework.name).toBe('AQA Performance Profile');
  });
}, 60000);
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: FAIL — `Cannot find module '../src/questionnaire/questionnaire.repository'`.

- [ ] **Step 6: `services/assessment/src/questionnaire/questionnaire.repository.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrameworkRepository, FrameworkWithStructure } from '../framework/framework.repository';
import { QuestionnaireEntity } from './questionnaire.entity';

export interface QuestionnaireWithFramework extends QuestionnaireEntity {
  framework: FrameworkWithStructure;
}

@Injectable()
export class QuestionnaireRepository {
  constructor(
    @InjectRepository(QuestionnaireEntity) private readonly questionnaires: Repository<QuestionnaireEntity>,
    private readonly frameworks: FrameworkRepository,
  ) {}

  findAll(): Promise<QuestionnaireEntity[]> {
    return this.questionnaires.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<QuestionnaireEntity | null> {
    return this.questionnaires.findOne({ where: { id } });
  }

  async create(name: string, direction: string, frameworkId: string): Promise<QuestionnaireEntity> {
    const framework = await this.frameworks.findByIdWithStructure(frameworkId);
    if (!framework) {
      throw new NotFoundException(`Framework ${frameworkId} not found`);
    }
    return this.questionnaires.save(this.questionnaires.create({ name, direction, frameworkId }));
  }

  async findByIdWithFramework(id: string): Promise<QuestionnaireWithFramework | null> {
    const questionnaire = await this.findById(id);
    if (!questionnaire) {
      return null;
    }
    const framework = await this.frameworks.findByIdWithStructure(questionnaire.frameworkId);
    if (!framework) {
      throw new NotFoundException(`Framework ${questionnaire.frameworkId} referenced by questionnaire ${id} is missing`);
    }
    return { ...questionnaire, framework };
  }
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: PASS (6 tests total).

- [ ] **Step 8: `services/assessment/src/questionnaire/questionnaire.controller.ts`**

```ts
import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestionnaireEntity } from './questionnaire.entity';
import { QuestionnaireRepository, QuestionnaireWithFramework } from './questionnaire.repository';
import { parseCreateQuestionnaireDto } from './questionnaire.dto';

@UseGuards(JwtAuthGuard)
@Controller('questionnaires')
export class QuestionnaireController {
  constructor(private readonly questionnaires: QuestionnaireRepository) {}

  @Get()
  list(): Promise<QuestionnaireEntity[]> {
    return this.questionnaires.findAll();
  }

  @Post()
  create(@Body() body: unknown): Promise<QuestionnaireEntity> {
    const dto = parseCreateQuestionnaireDto(body);
    return this.questionnaires.create(dto.name, dto.direction, dto.frameworkId);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<QuestionnaireWithFramework> {
    const questionnaire = await this.questionnaires.findByIdWithFramework(id);
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire ${id} not found`);
    }
    return questionnaire;
  }
}
```

- [ ] **Step 9: Update `services/assessment/src/app.module.ts`** — add `QuestionnaireEntity` to `entities`, `CreateQuestionnaire1723610000000` to `migrations`, `QuestionnaireController` to `controllers`, `QuestionnaireRepository` to `providers` (alongside all Task 3 entries, unchanged).

- [ ] **Step 10: Rebuild and rerun**

Run: `npm run build --workspace=@pmp/assessment && npm run test:e2e --workspace=@pmp/assessment`
Expected: both succeed.

- [ ] **Step 11: Commit**

```bash
git add services/assessment
git commit -m "feat(assessment): add Questionnaire entity and endpoints"
```

---

### Task 5: Review and Assessment (creation, listing, status)

**Files:**
- Create: `services/assessment/src/review/review.entity.ts`, `assessment.entity.ts`, `review.repository.ts`, `review.controller.ts`, `review.dto.ts`
- Create: `services/assessment/src/database/migrations/1723620000000-create-review.ts`
- Test: `services/assessment/test/review.e2e-spec.ts`
- Modify: `services/assessment/src/app.module.ts`

**Interfaces:**
- Consumes: `QuestionnaireRepository.findById` (Task 4).
- Produces: `ReviewEntity` (`assessment.reviews`: `id, questionnaireId, employeeEmail, leadEmail, createdAt`), `AssessmentEntity` (`assessment.assessments`: `id, reviewId, type varchar SELF|LEAD, status varchar DRAFT|SUBMITTED, submittedAt nullable`), `ReviewRepository.createReview(questionnaireId, employeeEmail, leadEmail): Promise<{ review: ReviewEntity; selfAssessmentId: string; leadAssessmentId: string }>` (creates the review and both assessments in one transaction), `.findAllForUser(email): Promise<ReviewEntity[]>`, `.findByIdWithAssessments(id): Promise<ReviewWithAssessments | null>`. Task 6's `AssessmentAnswerController` looks up an `AssessmentEntity` by id via `ReviewRepository.findAssessmentById` to enforce ownership/isolation.

- [ ] **Step 1: Migration — `services/assessment/src/database/migrations/1723620000000-create-review.ts`**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReview1723620000000 implements MigrationInterface {
  name = 'CreateReview1723620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment"."reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "questionnaire_id" uuid NOT NULL REFERENCES "assessment"."questionnaires"("id"),
        "employee_email" varchar NOT NULL,
        "lead_email" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."assessments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "review_id" uuid NOT NULL REFERENCES "assessment"."reviews"("id"),
        "type" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "submitted_at" timestamptz,
        UNIQUE ("review_id", "type")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."assessments"`);
    await queryRunner.query(`DROP TABLE "assessment"."reviews"`);
  }
}
```

- [ ] **Step 2: Entities**

`services/assessment/src/review/review.entity.ts`
```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reviews', schema: 'assessment' })
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'questionnaire_id' })
  questionnaireId: string;

  @Column({ name: 'employee_email' })
  employeeEmail: string;

  @Column({ name: 'lead_email' })
  leadEmail: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

`services/assessment/src/review/assessment.entity.ts`
```ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type AssessmentType = 'SELF' | 'LEAD';
export type AssessmentStatus = 'DRAFT' | 'SUBMITTED';

@Entity({ name: 'assessments', schema: 'assessment' })
@Unique(['reviewId', 'type'])
export class AssessmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'review_id' })
  reviewId: string;

  @Column({ type: 'varchar' })
  type: AssessmentType;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: AssessmentStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;
}
```

- [ ] **Step 3: `services/assessment/src/review/review.dto.ts`**

```ts
import { BadRequestException } from '@nestjs/common';

export interface CreateReviewDto {
  questionnaireId: string;
  employeeEmail: string;
  leadEmail: string;
}
export function parseCreateReviewDto(body: unknown): CreateReviewDto {
  const candidate = body as Partial<CreateReviewDto> | undefined;
  if (typeof candidate?.questionnaireId !== 'string' || candidate.questionnaireId.length === 0) {
    throw new BadRequestException('questionnaireId is required');
  }
  if (typeof candidate?.employeeEmail !== 'string' || candidate.employeeEmail.length === 0) {
    throw new BadRequestException('employeeEmail is required');
  }
  if (typeof candidate?.leadEmail !== 'string' || candidate.leadEmail.length === 0) {
    throw new BadRequestException('leadEmail is required');
  }
  return { questionnaireId: candidate.questionnaireId, employeeEmail: candidate.employeeEmail, leadEmail: candidate.leadEmail };
}
```

- [ ] **Step 4: Write the failing e2e test — `services/assessment/test/review.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { HealthController } from '../src/health/health.controller';
import { FrameworkEntity } from '../src/framework/framework.entity';
import { CategoryEntity } from '../src/framework/category.entity';
import { CompetencyEntity } from '../src/framework/competency.entity';
import { CompetencyGradeExpectationEntity } from '../src/framework/competency-grade-expectation.entity';
import { FrameworkRepository } from '../src/framework/framework.repository';
import { QuestionnaireEntity } from '../src/questionnaire/questionnaire.entity';
import { QuestionnaireRepository } from '../src/questionnaire/questionnaire.repository';
import { ReviewEntity } from '../src/review/review.entity';
import { AssessmentEntity } from '../src/review/assessment.entity';
import { ReviewRepository } from '../src/review/review.repository';
import { ReviewController } from '../src/review/review.controller';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from '../src/database/migrations/1723610000000-create-questionnaire';
import { CreateReview1723620000000 } from '../src/database/migrations/1723620000000-create-review';

describe('ReviewController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let employeeToken: string;
  let leadToken: string;
  let questionnaireId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [
            FrameworkEntity,
            CategoryEntity,
            CompetencyEntity,
            CompetencyGradeExpectationEntity,
            QuestionnaireEntity,
            ReviewEntity,
            AssessmentEntity,
          ],
          migrations: [CreateFramework1723600000000, CreateQuestionnaire1723610000000, CreateReview1723620000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          FrameworkEntity,
          CategoryEntity,
          CompetencyEntity,
          CompetencyGradeExpectationEntity,
          QuestionnaireEntity,
          ReviewEntity,
          AssessmentEntity,
        ]),
      ],
      controllers: [HealthController, ReviewController],
      providers: [FrameworkRepository, QuestionnaireRepository, ReviewRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = moduleFixture.get(JwtService);
    employeeToken = jwtService.sign({ sub: 'e1', email: 'qa1@racoongang.com' });
    leadToken = jwtService.sign({ sub: 'l1', email: 'lead1@racoongang.com' });

    const frameworks = moduleFixture.get(FrameworkRepository);
    const questionnaires = moduleFixture.get(QuestionnaireRepository);
    const framework = await frameworks.create('QA Performance Profile');
    const questionnaire = await questionnaires.create('Q1 2026 QA Review', 'QA', framework.id);
    questionnaireId = questionnaire.id;
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('creates a review with two DRAFT assessments (SELF, LEAD)', async () => {
    const response = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ questionnaireId, employeeEmail: 'qa1@racoongang.com', leadEmail: 'lead1@racoongang.com' })
      .expect(201);

    expect(response.body.review.employeeEmail).toBe('qa1@racoongang.com');
    expect(typeof response.body.selfAssessmentId).toBe('string');
    expect(typeof response.body.leadAssessmentId).toBe('string');
  });

  it('lists reviews for the current user as employee or lead', async () => {
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ questionnaireId, employeeEmail: 'qa1@racoongang.com', leadEmail: 'lead1@racoongang.com' })
      .expect(201);

    const asEmployee = await request(app.getHttpServer())
      .get('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    const asLead = await request(app.getHttpServer())
      .get('/reviews')
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(200);

    expect(asEmployee.body.length).toBeGreaterThan(0);
    expect(asLead.body.length).toBeGreaterThan(0);
  });

  it('GET /reviews/:id shows both assessment statuses without a comparison table yet', async () => {
    const created = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ questionnaireId, employeeEmail: 'qa1@racoongang.com', leadEmail: 'lead1@racoongang.com' })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/reviews/${created.body.review.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(fetched.body.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SELF', status: 'DRAFT' }),
        expect.objectContaining({ type: 'LEAD', status: 'DRAFT' }),
      ]),
    );
    expect(fetched.body.comparison).toBeUndefined();
  });
}, 60000);
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: FAIL — `Cannot find module '../src/review/review.repository'`.

- [ ] **Step 6: `services/assessment/src/review/review.repository.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionnaireRepository } from '../questionnaire/questionnaire.repository';
import { ReviewEntity } from './review.entity';
import { AssessmentEntity } from './assessment.entity';

export interface ReviewWithAssessments extends ReviewEntity {
  assessments: AssessmentEntity[];
}

@Injectable()
export class ReviewRepository {
  constructor(
    @InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(AssessmentEntity) private readonly assessments: Repository<AssessmentEntity>,
    private readonly questionnaires: QuestionnaireRepository,
  ) {}

  async createReview(
    questionnaireId: string,
    employeeEmail: string,
    leadEmail: string,
  ): Promise<{ review: ReviewEntity; selfAssessmentId: string; leadAssessmentId: string }> {
    const questionnaire = await this.questionnaires.findById(questionnaireId);
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire ${questionnaireId} not found`);
    }

    const review = await this.reviews.save(this.reviews.create({ questionnaireId, employeeEmail, leadEmail }));
    const selfAssessment = await this.assessments.save(
      this.assessments.create({ reviewId: review.id, type: 'SELF', status: 'DRAFT', submittedAt: null }),
    );
    const leadAssessment = await this.assessments.save(
      this.assessments.create({ reviewId: review.id, type: 'LEAD', status: 'DRAFT', submittedAt: null }),
    );

    return { review, selfAssessmentId: selfAssessment.id, leadAssessmentId: leadAssessment.id };
  }

  findAllForUser(email: string): Promise<ReviewEntity[]> {
    return this.reviews
      .createQueryBuilder('review')
      .where('review.employee_email = :email OR review.lead_email = :email', { email })
      .orderBy('review.created_at', 'DESC')
      .getMany();
  }

  async findByIdWithAssessments(id: string): Promise<ReviewWithAssessments | null> {
    const review = await this.reviews.findOne({ where: { id } });
    if (!review) {
      return null;
    }
    const assessments = await this.assessments.find({ where: { reviewId: id } });
    return { ...review, assessments };
  }

  findAssessmentById(assessmentId: string): Promise<AssessmentEntity | null> {
    return this.assessments.findOne({ where: { id: assessmentId } });
  }

  findReviewById(id: string): Promise<ReviewEntity | null> {
    return this.reviews.findOne({ where: { id } });
  }

  async markSubmitted(assessmentId: string): Promise<AssessmentEntity> {
    await this.assessments.update({ id: assessmentId }, { status: 'SUBMITTED', submittedAt: new Date() });
    const updated = await this.findAssessmentById(assessmentId);
    if (!updated) {
      throw new Error(`Assessment ${assessmentId} disappeared during submit`);
    }
    return updated;
  }
}
```

- [ ] **Step 7: `services/assessment/src/review/review.controller.ts`**

```ts
import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewEntity } from './review.entity';
import { ReviewRepository, ReviewWithAssessments } from './review.repository';
import { parseCreateReviewDto } from './review.dto';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviews: ReviewRepository) {}

  @Post()
  async create(
    @Body() body: unknown,
  ): Promise<{ review: ReviewEntity; selfAssessmentId: string; leadAssessmentId: string }> {
    const dto = parseCreateReviewDto(body);
    return this.reviews.createReview(dto.questionnaireId, dto.employeeEmail, dto.leadEmail);
  }

  @Get()
  list(@Req() request: Request): Promise<ReviewEntity[]> {
    return this.reviews.findAllForUser(request.user!.email);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<ReviewWithAssessments> {
    const review = await this.reviews.findByIdWithAssessments(id);
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }
    return review;
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: PASS (9 tests total).

- [ ] **Step 9: Update `services/assessment/src/app.module.ts`** — add `ReviewEntity`, `AssessmentEntity` to `entities`, `CreateReview1723620000000` to `migrations`, `ReviewController` to `controllers`, `ReviewRepository` to `providers`.

- [ ] **Step 10: Rebuild and rerun**

Run: `npm run build --workspace=@pmp/assessment && npm run test:e2e --workspace=@pmp/assessment`
Expected: both succeed.

- [ ] **Step 11: Commit**

```bash
git add services/assessment
git commit -m "feat(assessment): add Review and Assessment creation/listing"
```

---

### Task 6: Assessment answers — draft, submit, isolation

**Files:**
- Create: `services/assessment/src/assessment-answer/assessment-answer.entity.ts`, `assessment-answer.repository.ts`, `assessment.controller.ts`, `assessment-answer.dto.ts`
- Create: `services/assessment/src/database/migrations/1723630000000-create-assessment-answer.ts`
- Test: `services/assessment/test/assessment-answer.e2e-spec.ts`
- Modify: `services/assessment/src/app.module.ts`

**Interfaces:**
- Consumes: `ReviewRepository.findAssessmentById`/`.findReviewById`/`.markSubmitted` (Task 5), `FrameworkRepository`/`QuestionnaireRepository` (for submit validation — every competency in the questionnaire's framework must have an answer).
- Produces: `AssessmentAnswerEntity` (`assessment.assessment_answers`: `id, assessmentId, competencyId, grade, comment nullable, evidence nullable`, unique on `(assessmentId, competencyId)`). `GET /assessments/:id`, `PUT /assessments/:id/answers`, `POST /assessments/:id/submit` — the isolation rule from the design (owner always sees their own; anyone sees either once both `SUBMITTED`) is enforced here.

- [ ] **Step 1: Migration — `services/assessment/src/database/migrations/1723630000000-create-assessment-answer.ts`**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssessmentAnswer1723630000000 implements MigrationInterface {
  name = 'CreateAssessmentAnswer1723630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment"."assessment_answers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL REFERENCES "assessment"."assessments"("id"),
        "competency_id" uuid NOT NULL REFERENCES "assessment"."competencies"("id"),
        "grade" varchar NOT NULL,
        "comment" varchar,
        "evidence" varchar,
        UNIQUE ("assessment_id", "competency_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."assessment_answers"`);
  }
}
```

- [ ] **Step 2: `services/assessment/src/assessment-answer/assessment-answer.entity.ts`**

```ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'assessment_answers', schema: 'assessment' })
@Unique(['assessmentId', 'competencyId'])
export class AssessmentAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assessment_id' })
  assessmentId: string;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @Column()
  grade: string;

  @Column({ nullable: true })
  comment: string | null;

  @Column({ nullable: true })
  evidence: string | null;
}
```

- [ ] **Step 3: `services/assessment/src/assessment-answer/assessment-answer.dto.ts`**

```ts
import { BadRequestException } from '@nestjs/common';

export interface AnswerInput {
  competencyId: string;
  grade: string;
  comment?: string;
  evidence?: string;
}
export interface SaveAnswersDto {
  answers: AnswerInput[];
}
export function parseSaveAnswersDto(body: unknown): SaveAnswersDto {
  const candidate = body as Partial<SaveAnswersDto> | undefined;
  if (!Array.isArray(candidate?.answers)) {
    throw new BadRequestException('answers must be an array');
  }
  const answers = candidate.answers.map((entry, index) => {
    if (typeof entry?.competencyId !== 'string' || typeof entry?.grade !== 'string') {
      throw new BadRequestException(`answers[${index}] must have competencyId and grade`);
    }
    return {
      competencyId: entry.competencyId,
      grade: entry.grade,
      comment: typeof entry.comment === 'string' ? entry.comment : undefined,
      evidence: typeof entry.evidence === 'string' ? entry.evidence : undefined,
    };
  });
  return { answers };
}
```

- [ ] **Step 4: Write the failing e2e test — `services/assessment/test/assessment-answer.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { HealthController } from '../src/health/health.controller';
import { FrameworkEntity } from '../src/framework/framework.entity';
import { CategoryEntity } from '../src/framework/category.entity';
import { CompetencyEntity } from '../src/framework/competency.entity';
import { CompetencyGradeExpectationEntity } from '../src/framework/competency-grade-expectation.entity';
import { FrameworkRepository } from '../src/framework/framework.repository';
import { QuestionnaireEntity } from '../src/questionnaire/questionnaire.entity';
import { QuestionnaireRepository } from '../src/questionnaire/questionnaire.repository';
import { ReviewEntity } from '../src/review/review.entity';
import { AssessmentEntity } from '../src/review/assessment.entity';
import { ReviewRepository } from '../src/review/review.repository';
import { AssessmentAnswerEntity } from '../src/assessment-answer/assessment-answer.entity';
import { AssessmentAnswerRepository } from '../src/assessment-answer/assessment-answer.repository';
import { AssessmentController } from '../src/assessment-answer/assessment.controller';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from '../src/database/migrations/1723610000000-create-questionnaire';
import { CreateReview1723620000000 } from '../src/database/migrations/1723620000000-create-review';
import { CreateAssessmentAnswer1723630000000 } from '../src/database/migrations/1723630000000-create-assessment-answer';

describe('AssessmentController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let employeeToken: string;
  let leadToken: string;
  let competencyId: string;
  let selfAssessmentId: string;
  let leadAssessmentId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [
            FrameworkEntity,
            CategoryEntity,
            CompetencyEntity,
            CompetencyGradeExpectationEntity,
            QuestionnaireEntity,
            ReviewEntity,
            AssessmentEntity,
            AssessmentAnswerEntity,
          ],
          migrations: [
            CreateFramework1723600000000,
            CreateQuestionnaire1723610000000,
            CreateReview1723620000000,
            CreateAssessmentAnswer1723630000000,
          ],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          FrameworkEntity,
          CategoryEntity,
          CompetencyEntity,
          CompetencyGradeExpectationEntity,
          QuestionnaireEntity,
          ReviewEntity,
          AssessmentEntity,
          AssessmentAnswerEntity,
        ]),
      ],
      controllers: [HealthController, AssessmentController],
      providers: [FrameworkRepository, QuestionnaireRepository, ReviewRepository, AssessmentAnswerRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = moduleFixture.get(JwtService);
    employeeToken = jwtService.sign({ sub: 'e1', email: 'qa1@racoongang.com' });
    leadToken = jwtService.sign({ sub: 'l1', email: 'lead1@racoongang.com' });

    const frameworks = moduleFixture.get(FrameworkRepository);
    const questionnaires = moduleFixture.get(QuestionnaireRepository);
    const reviews = moduleFixture.get(ReviewRepository);

    const framework = await frameworks.create('QA Performance Profile');
    const category = await frameworks.addCategory(framework.id, 'Hard Skills', 0);
    const competency = await frameworks.addCompetency(category.id, 'Test Planning', undefined, 1, []);
    competencyId = competency.id;
    const questionnaire = await questionnaires.create('Q1 2026 QA Review', 'QA', framework.id);
    const created = await reviews.createReview(questionnaire.id, 'qa1@racoongang.com', 'lead1@racoongang.com');
    selfAssessmentId = created.selfAssessmentId;
    leadAssessmentId = created.leadAssessmentId;
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('lets the owner save a draft and read it back', async () => {
    await request(app.getHttpServer())
      .put(`/assessments/${selfAssessmentId}/answers`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ answers: [{ competencyId, grade: 'MIDDLE', comment: 'solid baseline' }] })
      .expect(200);

    const fetched = await request(app.getHttpServer())
      .get(`/assessments/${selfAssessmentId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(fetched.body.answers).toEqual([expect.objectContaining({ competencyId, grade: 'MIDDLE' })]);
  });

  it('blocks the lead from reading the self assessment while it is still DRAFT', async () => {
    await request(app.getHttpServer())
      .get(`/assessments/${selfAssessmentId}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(403);
  });

  it('rejects submit when a competency is unanswered, then succeeds once answered', async () => {
    await request(app.getHttpServer())
      .post(`/assessments/${leadAssessmentId}/submit`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .put(`/assessments/${leadAssessmentId}/answers`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ answers: [{ competencyId, grade: 'SENIOR' }] })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/assessments/${leadAssessmentId}/submit`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(201);
  });

  it('reveals both assessments to either party once both are SUBMITTED', async () => {
    await request(app.getHttpServer())
      .post(`/assessments/${selfAssessmentId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(201);

    const leadReadingSelf = await request(app.getHttpServer())
      .get(`/assessments/${selfAssessmentId}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(200);
    expect(leadReadingSelf.body.answers).toEqual([expect.objectContaining({ grade: 'MIDDLE' })]);
  });

  it('rejects editing answers after submit', async () => {
    await request(app.getHttpServer())
      .put(`/assessments/${selfAssessmentId}/answers`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ answers: [{ competencyId, grade: 'SENIOR' }] })
      .expect(400);
  });
}, 60000);
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: FAIL — `Cannot find module '../src/assessment-answer/assessment-answer.repository'`.

- [ ] **Step 6: `services/assessment/src/assessment-answer/assessment-answer.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerInput } from './assessment-answer.dto';
import { AssessmentAnswerEntity } from './assessment-answer.entity';

@Injectable()
export class AssessmentAnswerRepository {
  constructor(
    @InjectRepository(AssessmentAnswerEntity) private readonly answers: Repository<AssessmentAnswerEntity>,
  ) {}

  findByAssessmentId(assessmentId: string): Promise<AssessmentAnswerEntity[]> {
    return this.answers.find({ where: { assessmentId } });
  }

  async saveDraft(assessmentId: string, inputs: AnswerInput[]): Promise<void> {
    for (const input of inputs) {
      const existing = await this.answers.findOne({ where: { assessmentId, competencyId: input.competencyId } });
      if (existing) {
        await this.answers.update(
          { id: existing.id },
          { grade: input.grade, comment: input.comment ?? null, evidence: input.evidence ?? null },
        );
      } else {
        await this.answers.save(
          this.answers.create({
            assessmentId,
            competencyId: input.competencyId,
            grade: input.grade,
            comment: input.comment ?? null,
            evidence: input.evidence ?? null,
          }),
        );
      }
    }
  }
}
```

- [ ] **Step 7: `services/assessment/src/assessment-answer/assessment.controller.ts`**

```ts
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssessmentEntity } from '../review/assessment.entity';
import { ReviewRepository } from '../review/review.repository';
import { FrameworkRepository } from '../framework/framework.repository';
import { QuestionnaireRepository } from '../questionnaire/questionnaire.repository';
import { AssessmentAnswerEntity } from './assessment-answer.entity';
import { AssessmentAnswerRepository } from './assessment-answer.repository';
import { parseSaveAnswersDto } from './assessment-answer.dto';

@UseGuards(JwtAuthGuard)
@Controller('assessments')
export class AssessmentController {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly answers: AssessmentAnswerRepository,
    private readonly questionnaires: QuestionnaireRepository,
    private readonly frameworks: FrameworkRepository,
  ) {}

  private async loadAssessmentAndReview(assessmentId: string) {
    const assessment = await this.reviews.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }
    const review = await this.reviews.findReviewById(assessment.reviewId);
    if (!review) {
      throw new NotFoundException(`Review ${assessment.reviewId} not found`);
    }
    return { assessment, review };
  }

  private isOwner(assessment: AssessmentEntity, review: { employeeEmail: string; leadEmail: string }, email: string): boolean {
    return (assessment.type === 'SELF' && review.employeeEmail === email) ||
      (assessment.type === 'LEAD' && review.leadEmail === email);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<AssessmentEntity & { answers: AssessmentAnswerEntity[] }> {
    const { assessment, review } = await this.loadAssessmentAndReview(id);
    const isOwner = this.isOwner(assessment, review, request.user!.email);

    if (!isOwner) {
      const withAssessments = await this.reviews.findByIdWithAssessments(review.id);
      const bothSubmitted = withAssessments!.assessments.every((entry) => entry.status === 'SUBMITTED');
      if (!bothSubmitted) {
        throw new ForbiddenException('Cannot view this assessment yet');
      }
    }

    const answers = await this.answers.findByAssessmentId(id);
    return { ...assessment, answers };
  }

  @Put(':id/answers')
  async saveAnswers(@Param('id') id: string, @Req() request: Request, @Body() body: unknown): Promise<{ saved: true }> {
    const { assessment, review } = await this.loadAssessmentAndReview(id);
    if (!this.isOwner(assessment, review, request.user!.email)) {
      throw new ForbiddenException('Not the owner of this assessment');
    }
    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Assessment is no longer editable');
    }

    const dto = parseSaveAnswersDto(body);
    await this.answers.saveDraft(id, dto.answers);
    return { saved: true };
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @Req() request: Request): Promise<AssessmentEntity> {
    const { assessment, review } = await this.loadAssessmentAndReview(id);
    if (!this.isOwner(assessment, review, request.user!.email)) {
      throw new ForbiddenException('Not the owner of this assessment');
    }
    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Assessment already submitted');
    }

    const questionnaire = await this.questionnaires.findByIdWithFramework(review.questionnaireId);
    const allCompetencyIds = questionnaire!.framework.categories.flatMap((category) =>
      category.competencies.map((competency) => competency.id),
    );
    const answered = await this.answers.findByAssessmentId(id);
    const answeredIds = new Set(answered.map((entry) => entry.competencyId));
    const missing = allCompetencyIds.filter((competencyId) => !answeredIds.has(competencyId));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing answers for competencies: ${missing.join(', ')}`);
    }

    return this.reviews.markSubmitted(id);
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: PASS (14 tests total).

- [ ] **Step 9: Update `services/assessment/src/app.module.ts`** — add `AssessmentAnswerEntity` to `entities`, `CreateAssessmentAnswer1723630000000` to `migrations`, `AssessmentController` to `controllers`, `AssessmentAnswerRepository` to `providers`. `FrameworkRepository` and `QuestionnaireRepository` are already providers from earlier tasks — `AssessmentController` reuses them via DI, no changes needed there.

- [ ] **Step 10: Rebuild and rerun, plus lint**

Run: `npm run build --workspace=@pmp/assessment && npm run test:e2e --workspace=@pmp/assessment && npm run lint --workspace=@pmp/assessment`
Expected: all succeed.

- [ ] **Step 11: Commit**

```bash
git add services/assessment
git commit -m "feat(assessment): add draft/submit answers with isolation"
```

---

### Task 7: Comparison table on `GET /reviews/:id`

**Files:**
- Modify: `services/assessment/src/review/review.controller.ts`
- Modify: `services/assessment/src/review/review.repository.ts`
- Test: `services/assessment/test/review.e2e-spec.ts` (extend)

**Interfaces:**
- Consumes: `AssessmentAnswerRepository.findByAssessmentId` (Task 6).
- Produces: `GET /reviews/:id` response gains an optional `comparison: { competencyId: string; selfGrade: string; leadGrade: string }[]` field, present only when both assessments are `SUBMITTED`.

- [ ] **Step 1: Extend the e2e test — append to `services/assessment/test/review.e2e-spec.ts`**

Add this test inside the existing `describe('ReviewController (e2e)', ...)` block (after the existing three tests), and add the two new imports (`AssessmentAnswerEntity` from `'../src/assessment-answer/assessment-answer.entity'`, `AssessmentAnswerRepository` from `'../src/assessment-answer/assessment-answer.repository'`) to the top of the file, plus add both to the `TypeOrmModule.forRoot(...)`/`forFeature(...)` `entities` arrays and `AssessmentAnswerRepository` to the testing module's `providers` array (alongside the existing four):

```ts
  it('GET /reviews/:id includes a comparison once both assessments are submitted', async () => {
    const frameworks = app.get(FrameworkRepository);
    const questionnaires = app.get(QuestionnaireRepository);
    const reviews = app.get(ReviewRepository);
    const answers = app.get(AssessmentAnswerRepository);

    const framework = await frameworks.create('Comparison Test Framework');
    const category = await frameworks.addCategory(framework.id, 'Hard Skills', 0);
    const competency = await frameworks.addCompetency(category.id, 'Debugging', undefined, 1, []);
    const questionnaire = await questionnaires.create('Comparison Test Questionnaire', 'QA', framework.id);
    const created = await reviews.createReview(questionnaire.id, 'qa1@racoongang.com', 'lead1@racoongang.com');

    await answers.saveDraft(created.selfAssessmentId, [{ competencyId: competency.id, grade: 'MIDDLE' }]);
    await answers.saveDraft(created.leadAssessmentId, [{ competencyId: competency.id, grade: 'SENIOR' }]);
    await reviews.markSubmitted(created.selfAssessmentId);
    await reviews.markSubmitted(created.leadAssessmentId);

    const fetched = await request(app.getHttpServer())
      .get(`/reviews/${created.review.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(fetched.body.comparison).toEqual([
      { competencyId: competency.id, selfGrade: 'MIDDLE', leadGrade: 'SENIOR' },
    ]);
  });
```

Note: `app.get(...)` (NestJS's `INestApplication.get`) resolves a provider from the running application's DI container — this works because these repositories are already registered as providers in the test module. Add `import { FrameworkRepository } from '../src/framework/framework.repository';`, `import { QuestionnaireRepository } from '../src/questionnaire/questionnaire.repository';`, `import { AssessmentAnswerEntity } from '../src/assessment-answer/assessment-answer.entity';`, `import { AssessmentAnswerRepository } from '../src/assessment-answer/assessment-answer.repository';`, `import { CreateAssessmentAnswer1723630000000 } from '../src/database/migrations/1723630000000-create-assessment-answer';` to the top of the file if not already present.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:e2e --workspace=@pmp/assessment`
Expected: FAIL — `fetched.body.comparison` is `undefined`, test assertion fails.

- [ ] **Step 3: Add `findAnswersByAssessmentIds` support to `services/assessment/src/review/review.repository.ts`**

`ReviewRepository`'s constructor gains a fourth dependency. Update the constructor signature to:

```ts
  constructor(
    @InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(AssessmentEntity) private readonly assessments: Repository<AssessmentEntity>,
    private readonly questionnaires: QuestionnaireRepository,
  ) {}
```

stays as-is — the comparison logic belongs in the controller (Step 4), not the repository, since it needs `AssessmentAnswerRepository` which would create a circular module dependency if pulled into `ReviewRepository`. No repository changes in this task.

- [ ] **Step 4: Update `services/assessment/src/review/review.controller.ts`**

```ts
import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssessmentAnswerRepository } from '../assessment-answer/assessment-answer.repository';
import { ReviewEntity } from './review.entity';
import { ReviewRepository, ReviewWithAssessments } from './review.repository';
import { parseCreateReviewDto } from './review.dto';

interface ComparisonEntry {
  competencyId: string;
  selfGrade: string;
  leadGrade: string;
}

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly answers: AssessmentAnswerRepository,
  ) {}

  @Post()
  async create(
    @Body() body: unknown,
  ): Promise<{ review: ReviewEntity; selfAssessmentId: string; leadAssessmentId: string }> {
    const dto = parseCreateReviewDto(body);
    return this.reviews.createReview(dto.questionnaireId, dto.employeeEmail, dto.leadEmail);
  }

  @Get()
  list(@Req() request: Request): Promise<ReviewEntity[]> {
    return this.reviews.findAllForUser(request.user!.email);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<ReviewWithAssessments & { comparison?: ComparisonEntry[] }> {
    const review = await this.reviews.findByIdWithAssessments(id);
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }

    const bothSubmitted = review.assessments.every((entry) => entry.status === 'SUBMITTED');
    if (!bothSubmitted) {
      return review;
    }

    const selfAssessment = review.assessments.find((entry) => entry.type === 'SELF')!;
    const leadAssessment = review.assessments.find((entry) => entry.type === 'LEAD')!;
    const selfAnswers = await this.answers.findByAssessmentId(selfAssessment.id);
    const leadAnswers = await this.answers.findByAssessmentId(leadAssessment.id);
    const leadByCompetency = new Map(leadAnswers.map((entry) => [entry.competencyId, entry.grade]));

    const comparison: ComparisonEntry[] = selfAnswers
      .filter((entry) => leadByCompetency.has(entry.competencyId))
      .map((entry) => ({
        competencyId: entry.competencyId,
        selfGrade: entry.grade,
        leadGrade: leadByCompetency.get(entry.competencyId)!,
      }));

    return { ...review, comparison };
  }
}
```

- [ ] **Step 5: Update `services/assessment/src/app.module.ts`** — `ReviewController`'s constructor now needs `AssessmentAnswerRepository` injected; it's already a registered provider (Task 6), so no `providers` array change is needed — just confirm both `ReviewController` and `AssessmentAnswerRepository` are present (they are, from Tasks 5 and 6).

- [ ] **Step 6: Rebuild and rerun**

Run: `npm run build --workspace=@pmp/assessment && npm run test:e2e --workspace=@pmp/assessment`
Expected: both succeed (15 tests total).

- [ ] **Step 7: Commit**

```bash
git add services/assessment
git commit -m "feat(assessment): add Self vs Lead comparison to review detail"
```

---

### Task 8: Gateway reverse-proxy layer

**Files:**
- Create: `services/gateway/src/proxy/register-service-proxies.ts`
- Modify: `services/gateway/src/main.ts`
- Modify: `services/gateway/package.json` (add `http-proxy-middleware`)
- Test: `services/gateway/test/proxy.e2e-spec.ts`

**Interfaces:**
- Produces: `registerServiceProxies(app: INestExpressApplication): void`, mounted before `app.listen()`. Forwards `/api/auth/*` → `process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001'` and `/api/assessment/*` → `process.env.ASSESSMENT_SERVICE_URL ?? 'http://localhost:3003'`, stripping only the `/api` prefix, forwarding the `Authorization` header unchanged. Runs ahead of Gateway's own `JwtAuthGuard`/Nest routing — no auth logic in the proxy itself.

- [ ] **Step 1: Add `http-proxy-middleware` to `services/gateway/package.json` dependencies**

```json
    "http-proxy-middleware": "^3.0.3",
```

- [ ] **Step 2: Write the failing e2e test — `services/gateway/test/proxy.e2e-spec.ts`**

```ts
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { registerServiceProxies } from '../src/proxy/register-service-proxies';

function startMockUpstream(handler: (req: import('http').IncomingMessage, res: import('http').ServerResponse) => void): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('Gateway proxy (e2e)', () => {
  let app: INestApplication;
  let authUpstream: { server: Server; url: string };
  let assessmentUpstream: { server: Server; url: string };

  beforeAll(async () => {
    authUpstream = await startMockUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ path: req.url, authorization: req.headers.authorization ?? null }));
    });
    assessmentUpstream = await startMockUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ path: req.url, authorization: req.headers.authorization ?? null }));
    });

    process.env.AUTH_SERVICE_URL = authUpstream.url;
    process.env.ASSESSMENT_SERVICE_URL = assessmentUpstream.url;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    registerServiceProxies(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => authUpstream.server.close(resolve));
    await new Promise((resolve) => assessmentUpstream.server.close(resolve));
    delete process.env.AUTH_SERVICE_URL;
    delete process.env.ASSESSMENT_SERVICE_URL;
  });

  it('forwards /api/auth/* to the auth service with the /api prefix stripped', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/google')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({ path: '/auth/google', authorization: 'Bearer test-token' });
  });

  it('forwards /api/assessment/* to the assessment service with the /api prefix stripped', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/assessment/frameworks')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({ path: '/assessment/frameworks', authorization: 'Bearer test-token' });
  });

  it('still serves /health directly from the gateway, unproxied', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });
});
```

- [ ] **Step 3: Install and run to verify it fails**

Run: `npm install && npm run test:e2e --workspace=@pmp/gateway`
Expected: FAIL — `Cannot find module '../src/proxy/register-service-proxies'`.

- [ ] **Step 4: `services/gateway/src/proxy/register-service-proxies.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

export function registerServiceProxies(app: INestApplication): void {
  const authServiceUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
  const assessmentServiceUrl = process.env.ASSESSMENT_SERVICE_URL ?? 'http://localhost:3003';

  app.use(
    '/api/auth',
    createProxyMiddleware({
      target: authServiceUrl,
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    }),
  );

  app.use(
    '/api/assessment',
    createProxyMiddleware({
      target: assessmentServiceUrl,
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    }),
  );
}
```

- [ ] **Step 5: Update `services/gateway/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { registerServiceProxies } from './proxy/register-service-proxies';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  registerServiceProxies(app);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
```

`app.enableCors()` with no options allows any origin — acceptable for this demo slice (no cookies/credentials are used, the JWT travels in the `Authorization` header, not a cookie, so a permissive CORS policy doesn't expose anything sensitive to XSRF-style attacks). Note this as a known simplification, not a production posture.

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/gateway`
Expected: PASS (7 tests total: the existing health spec, the 3 whoami specs, and these 3).

- [ ] **Step 7: Build and lint**

Run: `npm run build --workspace=@pmp/gateway && npm run lint --workspace=@pmp/gateway`
Expected: both succeed.

- [ ] **Step 8: Commit**

```bash
git add services/gateway
git commit -m "feat(gateway): add reverse proxy to auth and assessment services"
```

---

### Task 9: Docker Compose wiring and full-stack verification

**Files:**
- Create: `services/assessment/Dockerfile`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `docker compose up --build` runs `postgres`, `rabbitmq`, `gateway`, `auth`, and `assessment` together, Gateway able to reach both `auth` and `assessment` by their compose service names.

- [ ] **Step 1: `services/assessment/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
# NOTE: npm ci validates package-lock.json against every workspace listed in
# root package.json's "workspaces" array. When a new service/package is added,
# its directory must be copied here too, or this build will fail.
COPY packages/shared ./packages/shared
COPY services/gateway ./services/gateway
COPY services/auth ./services/auth
COPY services/assessment ./services/assessment
RUN npm ci
RUN npm run build --workspace=@pmp/shared
RUN npm run build --workspace=@pmp/assessment
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/services/assessment/dist ./services/assessment/dist
COPY --from=build --chown=node:node /app/services/assessment/package.json ./services/assessment/package.json
USER node
EXPOSE 3003
CMD ["node", "services/assessment/dist/main.js"]
```

- [ ] **Step 2: Modify `docker-compose.yml`**

Add `AUTH_SERVICE_URL`/`ASSESSMENT_SERVICE_URL` to `gateway`'s `environment`, add `assessment` to `gateway`'s `depends_on`, and add a new `assessment` service block modeled on the existing `auth` block:

```yaml
  assessment:
    build:
      context: .
      dockerfile: services/assessment/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://pmp:pmp_dev_password@postgres:5432/pmp
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set}
    ports:
      - "127.0.0.1:3003:3003"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3003/health"]
      interval: 10s
      timeout: 5s
      retries: 10
```

`gateway`'s `environment` block gains:
```yaml
      AUTH_SERVICE_URL: http://auth:3001
      ASSESSMENT_SERVICE_URL: http://assessment:3003
```
and its `depends_on` gains:
```yaml
      assessment:
        condition: service_healthy
```

- [ ] **Step 3: Build and start the full stack**

Run: `JWT_SECRET=pmp_dev_jwt_secret_change_me GOOGLE_CLIENT_ID=dev-google-client-id docker compose up --build -d`
Expected: five containers start; `postgres`, `auth`, `gateway`, `assessment` all `healthy`.

- [ ] **Step 4: Verify the proxy end to end through the Gateway**

Run: `curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/google -H 'Content-Type: application/json' -d '{}'`
Expected: `400` (Auth Service's own `idToken is required` validation — proves the proxy reached the real Auth Service, not a 404 from the Gateway itself).

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/assessment/frameworks`
Expected: `401` (Assessment Service's own guard — no token supplied — proves the proxy reached the real Assessment Service).

- [ ] **Step 5: Tear down**

Run: `JWT_SECRET=pmp_dev_jwt_secret_change_me GOOGLE_CLIENT_ID=dev-google-client-id docker compose down -v`
Expected: containers and the `postgres_data` volume are removed cleanly.

- [ ] **Step 6: Commit**

```bash
git add services/assessment/Dockerfile docker-compose.yml
git commit -m "feat(infra): wire assessment service and gateway proxy into docker-compose"
```

- [ ] **Step 7: Push the branch, open a PR, confirm CI passes**

Run: `git push -u origin feature/assessment-service`
Open a PR (the workflow triggers on `pull_request`, not bare branch pushes — same as prior plans needed).
Then: `gh run list --branch feature/assessment-service --limit 1`
Expected: `completed` / `success`. CI's existing Postgres service already covers `@pmp/assessment`'s testcontainers-independent unit run; its e2e suite spins up its own containers via testcontainers, same as `@pmp/auth`'s. If it fails, `gh run view --log-failed` and fix before proceeding.

---

## Self-Review Notes

- **Spec coverage:** implements design doc sections 4 (data model), 5 (API), 6 (Gateway proxy) in full. Section 7 (Frontend) and its dependency on this backend is the sibling plan `docs/superpowers/plans/2026-08-12-assessment-frontend.md`. The isolation rule (§4) is exercised end to end in Task 6's e2e test (blocked-while-draft, revealed-once-both-submitted). Section 9's explicit exclusions (User & Org integration, Review state machine, RabbitMQ, versioning, Results service, Notification/Audit, role-based UI) are respected — nothing in this plan builds toward any of them.
- **Placeholder scan:** no TBD/TODO; every step has concrete file content or an exact command with expected output.
- **Type consistency:** `AssessmentType`/`AssessmentStatus` (Task 5) are used identically in the entity, repository, and controller across Tasks 5–7. `FrameworkWithStructure`/`QuestionnaireWithFramework`/`ReviewWithAssessments` (Tasks 3–5) are the exact return types Task 6/7's controllers destructure. `ComparisonEntry` (Task 7) matches the shape asserted in that task's e2e test.
- **Scope check:** one coherent backend slice (Questionnaire Builder + Self/Lead Assessment + the one piece of Gateway wiring needed to expose it) — independently buildable, testable via its own e2e suite, and deployable via `docker compose up`, with no dependency on the unexecuted `services/org` plan or the frontend plan.
