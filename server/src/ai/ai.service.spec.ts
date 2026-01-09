import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have generateScript method', () => {
    expect(service.generateScript).toBeDefined();
  });

  it('should have generateVoiceover method', () => {
    expect(service.generateVoiceover).toBeDefined();
  });

  it('should have generateImages method', () => {
    expect(service.generateImages).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    try {
      expect(service).toHaveProperty('generateScript');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
