
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
// ... (keep existing imports)

// ... (keep existing code until bootstrap function)

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Explicitly create a logger to use during bootstrap
    logger: new Logger('Bootstrap'),
  });
  
  // ... (keep existing app setup)

  const port = process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 3001;
  await app.listen(port);
  app.get(Logger).log(`✅ Backend running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
