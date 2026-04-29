import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProjectsModule } from './projects/projects.module';
import { VideoModule } from './video/video.module';
import { AiModule } from './ai/ai.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ResearchModule } from './research/research.module';
import { EngineModule } from './engine/engine.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { BullModule } from '@nestjs/bullmq';
import { join } from 'path';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '..', 'dist'),
      exclude: ['/api/(.*)', '/videos/(.*)'],
    }, {
      rootPath: join(process.cwd(), 'public/videos'),
      serveRoot: '/videos',
      exclude: ['/api/(.*)'],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: join(process.cwd(), 'data', 'database.sqlite'),
      autoLoadEntities: true,
      synchronize: true, 
      logging: true,
    }),
    ProjectsModule,
    VideoModule,
    AiModule,
    UsersModule,
    AuthModule,
    ResearchModule,
    EngineModule,
  ],
})
export class AppModule {}
