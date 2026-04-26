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
        externalTempDir,
        projectId
      } = job.data;

      // Add event listener to capture cancellation and explicitly kill ffmpeg
      const abortController = new AbortController();
      // BullMQ jobs themselves do not have .on() synchronously during processing in the Worker.
      // Abort should happen if the worker itself receives a close event, but we can pass
      // the controller and handle internal failures cleanly.

      const result = await this.videoService.processAssembly(
        audioPath,
        imagePaths,
        inputDuration,
        script,
        bgMusicPath,
        externalTempDir,
        projectId,
        abortController.signal
      );

      return result;
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}
