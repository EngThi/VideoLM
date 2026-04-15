import { Module } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ProjectsModule } from '../projects/projects.module';
import { NotebookLMEngine } from './notebook-lm.engine';

@Module({
  imports: [ProjectsModule],
  providers: [ResearchService, NotebookLMEngine],
  exports: [ResearchService],
})
export class ResearchModule {}
