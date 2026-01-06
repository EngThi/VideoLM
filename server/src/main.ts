
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3000;
  const server = await app.listen(port);
  server.setTimeout(300000); // 5 minutes timeout
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
