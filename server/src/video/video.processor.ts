import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { VideoService } from './video.service';
import { Logger } from '@nestjs/common';

@Processor('video-render', {
  concurrency: 1, // Limita a VM de 4GB a processar 1 render por vez
})
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(private readonly videoService: VideoService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Processing job ${job.id} for project ${job.data.projectId}`);

    try {
      const {
        audioFile,
        imageFiles,
        inputDuration,
        script,
        bgMusicFile,
        externalTempDir,
        projectId
      } = job.data;

      // Convert buffer objects back to Buffers
      if (audioFile && audioFile.buffer) {
        audioFile.buffer = Buffer.from(audioFile.buffer);
      }
      if (bgMusicFile && bgMusicFile.buffer) {
        bgMusicFile.buffer = Buffer.from(bgMusicFile.buffer);
      }
      if (imageFiles) {
        for (const img of imageFiles) {
          if (img.buffer) img.buffer = Buffer.from(img.buffer);
        }
      }

      const result = await this.videoService.processAssembly(
        audioFile,
        imageFiles,
        inputDuration,
        script,
        bgMusicFile,
        externalTempDir,
        projectId
      );

      return result;
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}
