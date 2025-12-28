
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { VideoModule } from './video/video.module';
import * as path from 'path';
import * as fs from 'fs';

// Determine the static path
const dockerClientPath = path.join(__dirname, '../../client/dist');
const localClientPath = path.join(__dirname, '../../dist');

// We need to pass a valid rootPath to ServeStaticModule.
// If neither exists (e.g. during simple server build without frontend), we might need a dummy or conditional.
// However, `rootPath` is required. We can default to localClientPath.
let rootPath = localClientPath;
if (fs.existsSync(dockerClientPath)) {
  rootPath = dockerClientPath;
}

@Module({
  imports: [
    VideoModule,
    ServeStaticModule.forRoot({
      rootPath: rootPath,
      exclude: ['/api/(.*)'], // Exclude API routes from static serving
      serveStaticOptions: {
         fallthrough: true // If file not found, fall through (useful for SPA routing if we had a catch-all)
      }
    }),
  ],
})
export class AppModule {}
