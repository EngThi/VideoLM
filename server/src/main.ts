
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  app.enableCors(); 

  // Aumentar o limite do Body para 100MB (necessário para upload de múltiplas imagens/áudios)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  const port = process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 3001;
  const server = await app.listen(port);
  
  // Aumentar timeout para 15 minutos (900000ms) para renderizações longas
  server.setTimeout(900000);
  
  logger.log(`✅ Backend running on http://localhost:${port} (Payload Limit: 100mb)`);
}
bootstrap();
g