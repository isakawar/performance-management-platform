# Auth Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Auth Service (Google Workspace OIDC login, `@racoongang.com` domain restriction, JWT issuance) and wire the Gateway to verify those JWTs on every request except `/health`.

**Architecture:** New `services/auth` NestJS microservice with its own `auth` Postgres schema (`auth_users` table: `id`, `google_sub`, `email`, `created_at`). `POST /auth/google` accepts a Google ID token, verifies it against Google's servers, enforces the corporate domain (BR-01/BR-02), finds-or-creates the local `AuthUser` row, and signs a JWT (`{ sub, email }`) with a shared secret. The Gateway gets a global `JwtAuthGuard` that verifies that same JWT on every route except ones marked `@Public()` (`/health` stays public; a new `GET /auth/me` proves the guard works end-to-end). Roles/RBAC claims are explicitly **out of scope** here — they belong to the User & Org Service (next plan in the sequence) and will extend the JWT payload later.

**Tech Stack:** NestJS 10, `@nestjs/jwt`, `@nestjs/typeorm` + TypeORM 0.3 + `pg` (Postgres access, migrations), `google-auth-library` (OIDC token verification), `testcontainers` / `@testcontainers/postgresql` (integration tests against real Postgres), Jest + Supertest, Docker / Docker Compose.

## Global Constraints

- Node.js 20 LTS everywhere (services, CI) — same as Platform Foundation.
- TypeScript `strict: true` in every package/service; `services/auth` additionally sets `strictPropertyInitialization: false` and `useDefineForClassFields: false` (required for TypeORM decorator-based entities to work correctly under an ES2022 target).
- npm workspaces — `services/auth` is a new workspace under `services/*`, no root config changes needed.
- Every service ships as its own Docker image; orchestration is Docker Compose.
- No service reaches into another service's database schema directly. Auth Service owns the `auth` Postgres schema exclusively; nothing outside this service queries `auth.auth_users` directly — future services get user data via the Auth/User & Org Service APIs, not SQL.
- Commit messages and any future PR text must never reference AI/Claude/Copilot or similar tooling.
- `JWT_SECRET` and `GOOGLE_CLIENT_ID` in `docker-compose.yml` are dev-only placeholders (same treatment as the Postgres/RabbitMQ passwords from Platform Foundation); production secrets management is out of scope (tracked in the architecture design doc, section 4).
- **Scope boundary:** this plan issues JWTs containing only `{ sub, email }` — no roles/permissions claims. RBAC claims are added once the User & Org Service (next plan) exists to supply role data. Note this explicitly in the PR description as a known follow-up, mirroring how Platform Foundation flagged its own deferred item.

---

## File Structure

```
services/auth/
├── package.json
├── tsconfig.json
├── jest.config.js
├── Dockerfile
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── health/
│   │   └── health.controller.ts
│   ├── domain/
│   │   ├── allowed-domain.ts              # BR-02 pure check
│   │   └── allowed-domain.spec.ts
│   ├── token/
│   │   ├── access-token-payload.ts
│   │   ├── auth-token.service.ts
│   │   └── auth-token.service.spec.ts
│   ├── google/
│   │   ├── google-oidc.verifier.ts
│   │   └── google-oidc.verifier.spec.ts
│   ├── auth-user/
│   │   ├── auth-user.entity.ts
│   │   └── auth-user.repository.ts
│   ├── database/
│   │   └── migrations/
│   │       └── 1723500000000-create-auth-users.ts
│   └── auth/
│       ├── google-login.dto.ts
│       └── auth.controller.ts
└── test/
    ├── jest-e2e.json
    ├── health.e2e-spec.ts
    ├── auth-user.repository.integration-spec.ts
    └── auth.controller.e2e-spec.ts

services/gateway/src/
└── auth/
    ├── public.decorator.ts
    ├── jwt-auth.guard.ts
    ├── jwt-auth.guard.spec.ts
    └── whoami.controller.ts
services/gateway/test/
└── whoami.e2e-spec.ts
(services/gateway/src/app.module.ts and src/health/health.controller.ts are modified)

docker-compose.yml            # modified: add `auth` service, JWT_SECRET on gateway
```

---

### Task 1: Auth Service scaffolding with a health endpoint

**Files:**
- Create: `services/auth/package.json`
- Create: `services/auth/tsconfig.json`
- Create: `services/auth/jest.config.js`
- Create: `services/auth/src/main.ts`
- Create: `services/auth/src/app.module.ts`
- Create: `services/auth/src/health/health.controller.ts`
- Create: `services/auth/test/jest-e2e.json`
- Test: `services/auth/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` (Platform Foundation, Task 1).
- Produces: a running NestJS app (`AppModule`) listening on `process.env.PORT ?? 3001`, exposing `GET /health` → `{ status: 'ok' }`. Every later task in this plan adds providers/controllers to this same `AppModule`.

- [ ] **Step 1: Create `services/auth/package.json`**

```json
{
  "name": "@pmp/auth",
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
    "google-auth-library": "^9.14.1",
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

- [ ] **Step 2: Create `services/auth/tsconfig.json`**

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

- [ ] **Step 3: Create `services/auth/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};
```

- [ ] **Step 4: Create `services/auth/test/jest-e2e.json`**

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

- [ ] **Step 5: Write the failing e2e test — `services/auth/test/health.e2e-spec.ts`**

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

- [ ] **Step 6: Install dependencies and run the test to verify it fails**

Run: `npm install && npm run test:e2e --workspace=@pmp/auth`
Expected: FAIL — `Cannot find module '../src/app.module'`.

- [ ] **Step 7: Write `services/auth/src/health/health.controller.ts`**

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

- [ ] **Step 8: Write `services/auth/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 9: Write `services/auth/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/auth`
Expected: PASS (1 test).

- [ ] **Step 11: Commit**

```bash
git checkout -b feature/auth-service
git add services/auth package-lock.json
git commit -m "feat(auth): add NestJS skeleton with health endpoint"
```

---

### Task 2: Corporate domain check (BR-02)

**Files:**
- Create: `services/auth/src/domain/allowed-domain.ts`
- Test: `services/auth/src/domain/allowed-domain.spec.ts`

**Interfaces:**
- Consumes: nothing (pure function, no dependencies).
- Produces: `assertAllowedDomain(email: string): void` — throws `UnauthorizedException` when the email's domain isn't `racoongang.com` (case-insensitive). Task 6's `AuthController` calls this right after Google verifies identity, before any database write.

- [ ] **Step 1: Write the failing test — `services/auth/src/domain/allowed-domain.spec.ts`**

```ts
import { UnauthorizedException } from '@nestjs/common';
import { assertAllowedDomain } from './allowed-domain';

describe('assertAllowedDomain', () => {
  it('allows an email on the corporate domain', () => {
    expect(() => assertAllowedDomain('qa1@racoongang.com')).not.toThrow();
  });

  it('is case-insensitive on the domain part', () => {
    expect(() => assertAllowedDomain('qa1@RacoonGang.com')).not.toThrow();
  });

  it('rejects an email on any other domain', () => {
    expect(() => assertAllowedDomain('someone@gmail.com')).toThrow(UnauthorizedException);
  });

  it('rejects a malformed email with no domain', () => {
    expect(() => assertAllowedDomain('not-an-email')).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@pmp/auth`
Expected: FAIL — `Cannot find module './allowed-domain'`.

- [ ] **Step 3: Write the implementation — `services/auth/src/domain/allowed-domain.ts`**

```ts
import { UnauthorizedException } from '@nestjs/common';

const ALLOWED_DOMAIN = 'racoongang.com';

export function assertAllowedDomain(email: string): void {
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain !== ALLOWED_DOMAIN) {
    throw new UnauthorizedException(`Email domain not allowed: ${email}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=@pmp/auth`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/auth/src/domain
git commit -m "feat(auth): enforce corporate email domain (BR-02)"
```

---

### Task 3: JWT issuance service

**Files:**
- Create: `services/auth/src/token/access-token-payload.ts`
- Create: `services/auth/src/token/auth-token.service.ts`
- Test: `services/auth/src/token/auth-token.service.spec.ts`

**Interfaces:**
- Consumes: `@nestjs/jwt`'s `JwtService` (constructed directly in the test with a fixed secret; wired via `JwtModule` into `AppModule` in Task 6).
- Produces: `interface AccessTokenPayload { sub: string; email: string }` and `AuthTokenService` with `issue(payload: AccessTokenPayload): string` and `verify(token: string): AccessTokenPayload`. Task 6's `AuthController` calls `issue()`; the Gateway's `JwtAuthGuard` (Task 7) independently verifies tokens signed here using the same shared secret, so both sides must agree on this exact payload shape: `{ sub, email }`.

- [ ] **Step 1: Create `services/auth/src/token/access-token-payload.ts`**

```ts
export interface AccessTokenPayload {
  sub: string;
  email: string;
}
```

- [ ] **Step 2: Write the failing test — `services/auth/src/token/auth-token.service.spec.ts`**

```ts
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } })],
      providers: [AuthTokenService],
    }).compile();

    service = moduleRef.get(AuthTokenService);
  });

  it('issues a token that verifies back to the same payload', () => {
    const token = service.issue({ sub: 'user-1', email: 'qa1@racoongang.com' });
    const decoded = service.verify(token);

    expect(decoded).toMatchObject({ sub: 'user-1', email: 'qa1@racoongang.com' });
  });

  it('throws when verifying a token signed with a different secret', async () => {
    const otherModuleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'other-secret' })],
      providers: [AuthTokenService],
    }).compile();
    const otherService = otherModuleRef.get(AuthTokenService);
    const tokenFromOtherSecret = otherService.issue({ sub: 'user-1', email: 'qa1@racoongang.com' });

    expect(() => service.verify(tokenFromOtherSecret)).toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=@pmp/auth`
Expected: FAIL — `Cannot find module './auth-token.service'`.

- [ ] **Step 4: Write the implementation — `services/auth/src/token/auth-token.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from './access-token-payload';

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  issue(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload);
  }

  verify(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@pmp/auth`
Expected: PASS (2 tests in this file, 6 total in the package).

- [ ] **Step 6: Commit**

```bash
git add services/auth/src/token
git commit -m "feat(auth): add JWT issuance service"
```

---

### Task 4: `AuthUser` persistence (TypeORM, `auth` schema, migration, testcontainers)

**Files:**
- Create: `services/auth/src/auth-user/auth-user.entity.ts`
- Create: `services/auth/src/auth-user/auth-user.repository.ts`
- Create: `services/auth/src/database/migrations/1723500000000-create-auth-users.ts`
- Test: `services/auth/test/auth-user.repository.integration-spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks in this file group; standalone TypeORM wiring.
- Produces: `AuthUserEntity` (table `auth.auth_users`, columns `id: uuid`, `googleSub: string` (column `google_sub`, unique), `email: string` (unique), `createdAt: Date`) and `AuthUserRepository.findOrCreate(googleSub: string, email: string): Promise<AuthUserEntity>` — idempotent by `googleSub`. Task 6's `AuthController` calls `findOrCreate()` after domain validation succeeds, and uses the returned `id` as the JWT's `sub` claim.

- [ ] **Step 1: Create `services/auth/src/auth-user/auth-user.entity.ts`**

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auth_users', schema: 'auth' })
export class AuthUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_sub', unique: true })
  googleSub: string;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 2: Create the migration — `services/auth/src/database/migrations/1723500000000-create-auth-users.ts`**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthUsers1723500000000 implements MigrationInterface {
  name = 'CreateAuthUsers1723500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "auth"`);
    await queryRunner.query(`
      CREATE TABLE "auth"."auth_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "google_sub" varchar NOT NULL UNIQUE,
        "email" varchar NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth"."auth_users"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "auth"`);
  }
}
```

- [ ] **Step 3: Write the implementation — `services/auth/src/auth-user/auth-user.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUserEntity } from './auth-user.entity';

@Injectable()
export class AuthUserRepository {
  constructor(
    @InjectRepository(AuthUserEntity)
    private readonly repository: Repository<AuthUserEntity>,
  ) {}

  async findOrCreate(googleSub: string, email: string): Promise<AuthUserEntity> {
    const existing = await this.repository.findOne({ where: { googleSub } });
    if (existing) {
      return existing;
    }

    const created = this.repository.create({ googleSub, email });
    return this.repository.save(created);
  }
}
```

- [ ] **Step 4: Write the failing integration test — `services/auth/test/auth-user.repository.integration-spec.ts`**

```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUserEntity } from '../src/auth-user/auth-user.entity';
import { AuthUserRepository } from '../src/auth-user/auth-user.repository';
import { CreateAuthUsers1723500000000 } from '../src/database/migrations/1723500000000-create-auth-users';

describe('AuthUserRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: AuthUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          schema: 'auth',
          entities: [AuthUserEntity],
          migrations: [CreateAuthUsers1723500000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([AuthUserEntity]),
      ],
      providers: [AuthUserRepository],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    repository = moduleRef.get(AuthUserRepository);
  }, 60000);

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('creates a new user on first login and reuses it on repeat logins', async () => {
    const first = await repository.findOrCreate('google-sub-1', 'qa1@racoongang.com');
    const second = await repository.findOrCreate('google-sub-1', 'qa1@racoongang.com');

    expect(second.id).toBe(first.id);
    expect(second.email).toBe('qa1@racoongang.com');
  });

  it('creates distinct users for distinct google subs', async () => {
    const first = await repository.findOrCreate('google-sub-2', 'lead1@racoongang.com');
    const second = await repository.findOrCreate('google-sub-3', 'qa2@racoongang.com');

    expect(first.id).not.toBe(second.id);
  });
}, 60000);
```

- [ ] **Step 5: Run the test to verify it fails, then passes**

Run: `npm run test:e2e --workspace=@pmp/auth`
Expected: first attempt fails with a TypeORM/module resolution error if any file is missing; once all three files above exist, it PASSES (2 tests). This step requires a local Docker daemon (testcontainers starts a real Postgres container) — same requirement CI already satisfies via GitHub Actions' Docker-enabled runners.

- [ ] **Step 6: Commit**

```bash
git add services/auth/src/auth-user services/auth/src/database services/auth/test/auth-user.repository.integration-spec.ts
git commit -m "feat(auth): add AuthUser entity, repository, and migration"
```

---

### Task 5: Google ID token verifier

**Files:**
- Create: `services/auth/src/google/google-oidc.verifier.ts`
- Test: `services/auth/src/google/google-oidc.verifier.spec.ts`

**Interfaces:**
- Consumes: `google-auth-library`'s `OAuth2Client`.
- Produces: `interface GoogleIdentity { googleSub: string; email: string }` and `GoogleOidcVerifier.verify(idToken: string): Promise<GoogleIdentity>` — throws `UnauthorizedException` when the token is invalid or the email isn't verified. Task 6's `AuthController` calls this first, before the domain check and before touching the database. `GoogleOidcVerifier` is constructed with a `clientId: string` (the Google OAuth client ID, injected via the `GOOGLE_CLIENT_ID` token wired in Task 6).

- [ ] **Step 1: Write the failing test — `services/auth/src/google/google-oidc.verifier.spec.ts`**

```ts
import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleOidcVerifier } from './google-oidc.verifier';

describe('GoogleOidcVerifier', () => {
  it('returns the googleSub and email from a valid, verified token', async () => {
    const verifier = new GoogleOidcVerifier('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'qa1@racoongang.com',
        email_verified: true,
      }),
    } as never);

    const identity = await verifier.verify('valid-token');

    expect(identity).toEqual({ googleSub: 'google-sub-1', email: 'qa1@racoongang.com' });
  });

  it('rejects a token whose email is not verified', async () => {
    const verifier = new GoogleOidcVerifier('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'qa1@racoongang.com',
        email_verified: false,
      }),
    } as never);

    await expect(verifier.verify('unverified-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token with no payload', async () => {
    const verifier = new GoogleOidcVerifier('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => undefined,
    } as never);

    await expect(verifier.verify('malformed-token')).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@pmp/auth`
Expected: FAIL — `Cannot find module './google-oidc.verifier'`.

- [ ] **Step 3: Write the implementation — `services/auth/src/google/google-oidc.verifier.ts`**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  googleSub: string;
  email: string;
}

@Injectable()
export class GoogleOidcVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }

    return { googleSub: payload.sub, email: payload.email };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=@pmp/auth`
Expected: PASS (3 tests in this file, 9 total in the package).

- [ ] **Step 5: Commit**

```bash
git add services/auth/src/google
git commit -m "feat(auth): add Google ID token verifier"
```

---

### Task 6: `AuthController` — POST /auth/google, wired end-to-end

**Files:**
- Create: `services/auth/src/auth/google-login.dto.ts`
- Create: `services/auth/src/auth/auth.controller.ts`
- Modify: `services/auth/src/app.module.ts`
- Test: `services/auth/test/auth.controller.e2e-spec.ts`

**Interfaces:**
- Consumes: `assertAllowedDomain` (Task 2), `AuthTokenService` (Task 3), `AuthUserRepository` (Task 4), `GoogleOidcVerifier` (Task 5).
- Produces: `POST /auth/google` with body `{ idToken: string }` → `201 { accessToken: string }` on success; `401` when the domain check or Google verification fails. This is the endpoint the frontend's "Sign in with Google" button calls in a later plan.

- [ ] **Step 1: Create `services/auth/src/auth/google-login.dto.ts`**

```ts
import { BadRequestException } from '@nestjs/common';

export interface GoogleLoginDto {
  idToken: string;
}

export function parseGoogleLoginDto(body: unknown): GoogleLoginDto {
  const idToken = (body as Partial<GoogleLoginDto> | undefined)?.idToken;
  if (typeof idToken !== 'string' || idToken.length === 0) {
    throw new BadRequestException('idToken is required');
  }
  return { idToken };
}
```

- [ ] **Step 2: Create `services/auth/src/auth/auth.controller.ts`**

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { assertAllowedDomain } from '../domain/allowed-domain';
import { GoogleOidcVerifier } from '../google/google-oidc.verifier';
import { AuthTokenService } from '../token/auth-token.service';
import { AuthUserRepository } from '../auth-user/auth-user.repository';
import { parseGoogleLoginDto } from './google-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly googleVerifier: GoogleOidcVerifier,
    private readonly authUserRepository: AuthUserRepository,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post('google')
  async loginWithGoogle(@Body() body: unknown): Promise<{ accessToken: string }> {
    const dto = parseGoogleLoginDto(body);
    const identity = await this.googleVerifier.verify(dto.idToken);
    assertAllowedDomain(identity.email);

    const user = await this.authUserRepository.findOrCreate(identity.googleSub, identity.email);
    const accessToken = this.authTokenService.issue({ sub: user.id, email: user.email });

    return { accessToken };
  }
}
```

- [ ] **Step 3: Update `services/auth/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { AuthController } from './auth/auth.controller';
import { GoogleOidcVerifier } from './google/google-oidc.verifier';
import { AuthTokenService } from './token/auth-token.service';
import { AuthUserRepository } from './auth-user/auth-user.repository';
import { AuthUserEntity } from './auth-user/auth-user.entity';
import { CreateAuthUsers1723500000000 } from './database/migrations/1723500000000-create-auth-users';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://pmp:pmp_dev_password@localhost:5432/pmp',
      schema: 'auth',
      entities: [AuthUserEntity],
      migrations: [CreateAuthUsers1723500000000],
      migrationsRun: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([AuthUserEntity]),
  ],
  controllers: [HealthController, AuthController],
  providers: [
    AuthTokenService,
    AuthUserRepository,
    {
      provide: GoogleOidcVerifier,
      useFactory: () => new GoogleOidcVerifier(process.env.GOOGLE_CLIENT_ID ?? 'dev-google-client-id'),
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Write the failing e2e test — `services/auth/test/auth.controller.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { HealthController } from '../src/health/health.controller';
import { AuthController } from '../src/auth/auth.controller';
import { AuthTokenService } from '../src/token/auth-token.service';
import { AuthUserRepository } from '../src/auth-user/auth-user.repository';
import { AuthUserEntity } from '../src/auth-user/auth-user.entity';
import { CreateAuthUsers1723500000000 } from '../src/database/migrations/1723500000000-create-auth-users';
import { GoogleOidcVerifier } from '../src/google/google-oidc.verifier';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let jwtService: JwtService;
  const googleVerifierStub = { verify: jest.fn() };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          schema: 'auth',
          entities: [AuthUserEntity],
          migrations: [CreateAuthUsers1723500000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([AuthUserEntity]),
      ],
      controllers: [HealthController, AuthController],
      providers: [
        AuthTokenService,
        AuthUserRepository,
        { provide: GoogleOidcVerifier, useValue: googleVerifierStub },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('issues a token for a first-time login on the allowed domain', async () => {
    googleVerifierStub.verify.mockResolvedValue({
      googleSub: 'google-sub-e2e-1',
      email: 'qa1@racoongang.com',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(201);

    expect(typeof response.body.accessToken).toBe('string');
    const decoded = jwtService.verify(response.body.accessToken);
    expect(decoded).toMatchObject({ email: 'qa1@racoongang.com' });
  });

  it('reuses the same user id across repeat logins', async () => {
    googleVerifierStub.verify.mockResolvedValue({
      googleSub: 'google-sub-e2e-2',
      email: 'lead1@racoongang.com',
    });

    const first = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(201);

    const firstSub = jwtService.verify<{ sub: string }>(first.body.accessToken).sub;
    const secondSub = jwtService.verify<{ sub: string }>(second.body.accessToken).sub;
    expect(secondSub).toBe(firstSub);
  });

  it('rejects a login from outside the corporate domain', async () => {
    googleVerifierStub.verify.mockResolvedValue({
      googleSub: 'google-sub-e2e-3',
      email: 'someone@gmail.com',
    });

    await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(401);
  });
}, 60000);
```

- [ ] **Step 5: Run the test to verify it fails, then passes**

Run: `npm run test:e2e --workspace=@pmp/auth`
Expected: fails first on whichever file is missing (`auth.controller.ts`, `google-login.dto.ts`, or the `app.module.ts` wiring) until all Step 1–3 files exist, then PASSES (3 tests in this file; the full `test:e2e` run — including Task 1 and Task 4's specs — is 6 tests total).

- [ ] **Step 6: Build the service to confirm it compiles cleanly**

Run: `npm run build --workspace=@pmp/auth`
Expected: succeeds, produces `services/auth/dist/main.js`.

- [ ] **Step 7: Commit**

```bash
git add services/auth/src/auth services/auth/src/app.module.ts services/auth/test/auth.controller.e2e-spec.ts
git commit -m "feat(auth): add POST /auth/google login endpoint"
```

---

### Task 7: Gateway — global JWT auth guard

**Files:**
- Create: `services/gateway/src/auth/public.decorator.ts`
- Create: `services/gateway/src/auth/jwt-auth.guard.ts`
- Create: `services/gateway/src/auth/whoami.controller.ts`
- Modify: `services/gateway/src/app.module.ts`
- Modify: `services/gateway/src/health/health.controller.ts`
- Modify: `services/gateway/package.json` (add `@nestjs/jwt` dependency)
- Test: `services/gateway/src/auth/jwt-auth.guard.spec.ts`
- Test: `services/gateway/test/whoami.e2e-spec.ts`

**Interfaces:**
- Consumes: the JWT payload shape from Auth Service Task 3 (`{ sub: string; email: string }`), verified with the same `JWT_SECRET` env var both services share.
- Produces: a global `JwtAuthGuard` (registered via `APP_GUARD`) that rejects any request without a valid `Authorization: Bearer <token>` header, except handlers/controllers marked `@Public()`. `GET /auth/me` (new) returns the decoded token payload — proof the guard and the token format are compatible with what Auth Service issues. Future plans add real proxy routes to the gateway; those routes get protection for free from this guard unless explicitly marked `@Public()`.

- [ ] **Step 1: Add `@nestjs/jwt` to `services/gateway/package.json` dependencies**

In `services/gateway/package.json`, add to `"dependencies"`:

```json
"@nestjs/jwt": "^10.2.0",
```

- [ ] **Step 2: Write the failing unit test — `services/gateway/src/auth/jwt-auth.guard.spec.ts`**

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [JwtAuthGuard, Reflector],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
    jwtService = moduleRef.get(JwtService);
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects a request with an invalid token', () => {
    expect(() =>
      guard.canActivate(makeContext({ authorization: 'Bearer not-a-real-token' })),
    ).toThrow(UnauthorizedException);
  });

  it('allows a request with a valid token and attaches the payload to request.user', () => {
    const token = jwtService.sign({ sub: 'user-1', email: 'qa1@racoongang.com' });
    const context = makeContext({ authorization: `Bearer ${token}` });

    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toMatchObject({ sub: 'user-1', email: 'qa1@racoongang.com' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm install && npm test --workspace=@pmp/gateway`
Expected: FAIL — `Cannot find module './jwt-auth.guard'`.

- [ ] **Step 4: Write `services/gateway/src/auth/public.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 5: Write `services/gateway/src/auth/jwt-auth.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      request.user = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }
}
```

- [ ] **Step 6: Run the unit test to verify it passes**

Run: `npm test --workspace=@pmp/gateway`
Expected: PASS (3 tests).

- [ ] **Step 7: Write `services/gateway/src/auth/whoami.controller.ts`**

```ts
import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('auth')
export class WhoAmIController {
  @Get('me')
  whoAmI(@Req() request: Request): unknown {
    return request.user;
  }
}
```

- [ ] **Step 8: Mark the health endpoint public — modify `services/gateway/src/health/health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 9: Register the guard globally — modify `services/gateway/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './health/health.controller';
import { WhoAmIController } from './auth/whoami.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    }),
  ],
  controllers: [HealthController, WhoAmIController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
```

- [ ] **Step 10: Write the failing e2e test — `services/gateway/test/whoami.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('WhoAmI (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests to /auth/me without a token', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the decoded payload for a request with a valid token', async () => {
    const token = jwtService.sign({ sub: 'user-1', email: 'qa1@racoongang.com' });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({ sub: 'user-1', email: 'qa1@racoongang.com' });
  });

  it('still allows unauthenticated access to /health', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });
});
```

- [ ] **Step 11: Run the e2e test to verify it passes**

Run: `npm run test:e2e --workspace=@pmp/gateway`
Expected: PASS (4 tests total: the existing health spec plus these 3).

- [ ] **Step 12: Build the gateway to confirm it compiles cleanly**

Run: `npm run build --workspace=@pmp/gateway`
Expected: succeeds.

- [ ] **Step 13: Commit**

```bash
git add services/gateway
git commit -m "feat(gateway): add global JWT auth guard"
```

---

### Task 8: Docker Compose wiring, env vars, and full-stack verification

**Files:**
- Create: `services/auth/Dockerfile`
- Modify: `docker-compose.yml` (add `auth` service; add `JWT_SECRET` to `gateway`)

**Interfaces:**
- Consumes: `@pmp/shared` build pattern from Platform Foundation's `services/gateway/Dockerfile`; `AuthController`'s runtime env vars (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`).
- Produces: `docker compose up --build` runs `postgres`, `rabbitmq`, `gateway`, and `auth` together, with `gateway` and `auth` sharing the same `JWT_SECRET` so tokens issued by one are accepted by the other.

- [ ] **Step 1: Create `services/auth/Dockerfile`**

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
RUN npm ci
RUN npm run build --workspace=@pmp/shared
RUN npm run build --workspace=@pmp/auth
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/auth/dist ./services/auth/dist
COPY --from=build --chown=node:node /app/services/auth/package.json ./services/auth/package.json
USER node
EXPOSE 3001
CMD ["node", "services/auth/dist/main.js"]
```

- [ ] **Step 2: Add the `auth` service and shared `JWT_SECRET` to `docker-compose.yml`**

Modify `docker-compose.yml`: add `JWT_SECRET` to the existing `gateway` service's `environment` block, and add a new `auth` service. The resulting file:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: pmp
      POSTGRES_PASSWORD: pmp_dev_password
      POSTGRES_DB: pmp
    ports:
      - "127.0.0.1:5432:5432"
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
      - "127.0.0.1:5672:5672"
      - "127.0.0.1:15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  auth:
    build:
      context: .
      dockerfile: services/auth/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://pmp:pmp_dev_password@postgres:5432/pmp
      JWT_SECRET: pmp_dev_jwt_secret_change_me
      JWT_EXPIRES_IN: 8h
      GOOGLE_CLIENT_ID: replace-with-real-google-oauth-client-id
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 10

  gateway:
    build:
      context: .
      dockerfile: services/gateway/Dockerfile
    restart: unless-stopped
    environment:
      JWT_SECRET: pmp_dev_jwt_secret_change_me
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

- [ ] **Step 3: Build and start the full stack**

Run: `docker compose up --build -d`
Expected: four containers start; `docker compose ps` shows `postgres` `healthy`, `auth` and `gateway` `healthy` (rabbitmq unaffected).

- [ ] **Step 4: Verify both services' health endpoints**

Run: `curl -sf http://localhost:3001/health && curl -sf http://localhost:3000/health`
Expected: both print `{"status":"ok"}`.

- [ ] **Step 5: Verify the gateway rejects an unauthenticated request to the protected route**

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/auth/me`
Expected: `401`.

- [ ] **Step 6: Tear down**

Run: `docker compose down -v`
Expected: containers and the `postgres_data` volume are removed cleanly.

- [ ] **Step 7: Commit**

```bash
git add services/auth/Dockerfile docker-compose.yml
git commit -m "feat(infra): wire auth service into docker-compose"
```

- [ ] **Step 8: Push the branch and confirm CI passes**

Run: `git push -u origin feature/auth-service`
Then check the run: `gh run list --branch feature/auth-service --limit 1`
Expected: a run appears with status `completed` / conclusion `success`. If it fails, open the run (`gh run view --log-failed`) and fix before opening the PR. The testcontainers-based integration tests (Tasks 4 and 6) run inside GitHub Actions' Docker-enabled `ubuntu-latest` runner with no extra CI config needed.

---

## Self-Review Notes

- **Spec coverage:** implements BR-01 (SSO-only access — no password path exists), BR-02 (domain restriction, `assertAllowedDomain`), and the architecture doc §3.1 Auth Service bounded context (Google OIDC handshake, JWT issuance). Pre-populated users (§4.3 of the requirements doc) and roles/RBAC claims are explicitly deferred to the User & Org Service plan — noted in Global Constraints and the PR description.
- **Placeholder scan:** no TBD/TODO; every step has concrete file content or an exact command with expected output.
- **Type consistency:** `AccessTokenPayload { sub, email }` (Task 3) is the single JWT payload shape used everywhere — `AuthController` (Task 6) populates it from `AuthUserEntity.id`/`.email`, and the gateway's `JwtAuthGuard` (Task 7) decodes into the same shape via `request.user`. `GoogleIdentity { googleSub, email }` (Task 5) and `AuthUserRepository.findOrCreate(googleSub, email)` (Task 4) use matching parameter names throughout.
- **Scope check:** single bounded context (Auth Service) plus the one piece of Gateway wiring the architecture doc assigns to this phase (JWT verification middleware) — independently buildable, testable, and deployable via `docker compose up`.
