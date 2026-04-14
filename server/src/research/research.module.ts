import { Module } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
