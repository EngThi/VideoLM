import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ProjectsModule } from './projects/projects.module';
import { VideoModule } from './video/video.module';
import * as path from 'path';
import * as fs from 'fs';

// Determine the static path
const dockerClientPath = path.join(__dirname, '../../client/dist');
const localClientPath = path.join(__dirname, '../../dist');

let rootPath = localClientPath;
if (fs.existsSync(dockerClientPath)) {
  rootPath = dockerClientPath;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'homes.db',
      entities: ['dist/**/*.entity{.ts,.js}'],
      synchronize: true, // Auto-create tables (Dev only)
    }),
    ProjectsModule,
    VideoModule,
    ServeStaticModule.forRoot({
      rootPath: rootPath,
      exclude: ['/api/(.*)'],
      serveStaticOptions: {
         fallthrough: true
      }
    }),
  ],
})
export class AppModule {}