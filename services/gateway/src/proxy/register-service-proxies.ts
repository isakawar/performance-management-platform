import { INestApplication } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

export function registerServiceProxies(app: INestApplication): void {
  const authServiceUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
  const assessmentServiceUrl = process.env.ASSESSMENT_SERVICE_URL ?? 'http://localhost:3003';

  app.use(
    createProxyMiddleware({
      pathFilter: '/api/auth/**',
      target: authServiceUrl,
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    }),
  );

  app.use(
    createProxyMiddleware({
      pathFilter: '/api/assessment/**',
      target: assessmentServiceUrl,
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    }),
  );
}
