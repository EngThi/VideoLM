import { Module } from '@nestjs/common';
import { EngineController } from './engine.controller';
import { ResearchModule } from '../research/research.module';

@Module({
  imports: [ResearchModule],
  controllers: [EngineController],
})
export class EngineModule {}
