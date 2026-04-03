
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  app.enableCors(); // Ensure CORS is enabled for the frontend

  const port = process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 3001;
  const server = await app.listen(port);
  
  // Aumentar timeout para 15 minutos (900000ms) para renderizações longas
  server.setTimeout(900000);
  
  logger.log(`✅ Backend running on http://localhost:${port} (Timeout: 15m)`);
}
bootstrap();
