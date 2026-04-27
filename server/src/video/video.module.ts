import { Module, forwardRef } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoDemoController } from './video.demo.controller';
import { VideoService } from './video.service';
import { ProjectsModule } from '../projects/projects.module';
import { AiModule } from '../ai/ai.module';
import { VideoGateway } from './video.gateway';
import { BullModule } from '@nestjs/bullmq';
import { VideoProcessor } from './video.processor';

@Module({
  imports: [
    ProjectsModule,
    forwardRef(() => AiModule),
    BullModule.registerQueue({
      name: 'video-render',
    }),
  ],
  controllers: [VideoController, VideoDemoController],
  providers: [VideoService, VideoGateway, VideoProcessor],
  exports: [VideoService],
})
export class VideoModule {}
