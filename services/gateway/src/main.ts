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
