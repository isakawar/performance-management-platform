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

// Echoes back path/authorization (as before) plus the raw request body, so tests can
// assert the proxy actually forwards a POST body rather than dropping/consuming it.
function echoingHandler(req: import('http').IncomingMessage, res: import('http').ServerResponse): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    let body: unknown = null;
    try {
      body = rawBody.length > 0 ? JSON.parse(rawBody) : null;
    } catch {
      body = rawBody;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ path: req.url, authorization: req.headers.authorization ?? null, body }));
  });
}

describe('Gateway proxy (e2e)', () => {
  let app: INestApplication;
  let authUpstream: { server: Server; url: string };
  let assessmentUpstream: { server: Server; url: string };

  beforeAll(async () => {
    authUpstream = await startMockUpstream(echoingHandler);
    assessmentUpstream = await startMockUpstream(echoingHandler);

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

    expect(response.body).toEqual({ path: '/auth/google', authorization: 'Bearer test-token', body: null });
  });

  it('forwards /api/assessment/* to the assessment service with the /api prefix stripped', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/assessment/frameworks')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({ path: '/assessment/frameworks', authorization: 'Bearer test-token', body: null });
  });

  it('still serves /health directly from the gateway, unproxied', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('forwards the JSON request body on a proxied POST (guards against body-parser/proxy ordering regressions)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/google')
      .send({ test: 'value' })
      .expect(200);

    expect(response.body).toEqual({
      path: '/auth/google',
      authorization: null,
      body: { test: 'value' },
    });
  });

  it('forwards the JSON request body on a proxied POST to the assessment service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/assessment/frameworks')
      .send({ test: 'value' })
      .expect(200);

    expect(response.body).toEqual({
      path: '/assessment/frameworks',
      authorization: null,
      body: { test: 'value' },
    });
  });
});
