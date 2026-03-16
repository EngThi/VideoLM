
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  app.enableCors(); // Ensure CORS is enabled for the frontend

  const port = process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 3001;
  await app.listen(port);
  logger.log(`✅ Backend running on http://localhost:${port}`);
}
bootstrap();
