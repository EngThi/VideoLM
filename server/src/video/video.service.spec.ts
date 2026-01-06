
import { Test, TestingModule } from '@nestjs/testing';
import { VideoService } from './video.service';

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  const mFfmpeg = jest.fn(() => ({
    input: jest.fn().mockReturnThis(),
    inputOptions: jest.fn().mockReturnThis(),
    complexFilter: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function(event, callback) {
        if (event === 'end') {
           // trigger later or return this
        }
        return this; 
    }),
    run: jest.fn(),
  }));

  (mFfmpeg as any).setFfmpegPath = jest.fn();
  (mFfmpeg as any).setFfprobePath = jest.fn();
  (mFfmpeg as any).ffprobe = jest.fn((path, cb) => {
      // Mock ffprobe result
      cb(null, { format: { duration: 100 } }); 
  });

  return mFfmpeg;
});

describe('VideoService', () => {
  let service: VideoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VideoService],
    }).compile();

    service = module.get<VideoService>(VideoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // We can add more specific tests here later
  // For example, testing if generateSrt produces valid SRT format
  // But since it's private, we might need to expose it or test via assembleVideo
});
