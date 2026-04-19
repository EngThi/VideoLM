import { Module } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { ProjectsModule } from '../projects/projects.module';
import { NotebookLMEngine } from './notebook-lm.engine';

@Module({
  imports: [ProjectsModule, AiModule, VideoModule],
  providers: [ResearchService, NotebookLMEngine],
  controllers: [ResearchController],
  exports: [ResearchService],
})
export class ResearchModule {}
