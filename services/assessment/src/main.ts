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
