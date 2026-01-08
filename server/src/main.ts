
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof Error ? exception.message : 'Unknown error';
    const stack = exception instanceof Error ? exception.stack : '';

    const logMessage = `[${new Date().toISOString()}] ${request.method} ${request.url} - Status: ${status} - Error: ${message}\nStack: ${stack}\n\n`;
    
    // Log to file
    try {
        fs.appendFileSync(path.join(__dirname, '../../server.log'), logMessage);
    } catch (e) {
        console.error('Failed to write to log file', e);
    }
    
    console.error(logMessage);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Aumentar limite de payload para 100MB
  const { json, urlencoded } = require('express');
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));
  
  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // Global Filter
  app.useGlobalFilters(new GlobalErrorFilter());
  
  // CORS
  app.enableCors({
    origin: '*', // Allow all for dev
    credentials: true,
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`✅ Backend running on http://localhost:${port}`);
}

bootstrap();
