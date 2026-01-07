

import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { ProjectsModule } from '../projects/projects.module';
import { VideoGateway } from './video.gateway';

@Module({
  imports: [ProjectsModule],
  controllers: [VideoController],
  providers: [VideoService, VideoGateway],
  exports: [VideoService],
})
export class VideoModule {}
