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
        audioPath,
        imagePaths,
        inputDuration,
        script,
        bgMusicPath,
        bRollPath, // Novo
        externalTempDir,
        projectId
      } = job.data;

      // ...

      const result = await this.videoService.processAssembly(
        audioPath,
        imagePaths,
        inputDuration,
        script,
        bgMusicPath,
        externalTempDir,
        projectId,
        abortController.signal,
        bRollPath // Novo
      );
      return result;
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}
