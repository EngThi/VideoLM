import { Test, TestingModule } from '@nestjs/testing';
import { VideoService } from './video.service';
import { ProjectsService } from '../projects/projects.service';
import { VideoGateway } from './video.gateway';
import { AiService } from '../ai/ai.service';
import { getQueueToken } from '@nestjs/bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';

// Use fake timers to control setTimeout
jest.useFakeTimers();

// Mock the external dependencies
jest.mock('fs', () => require('memfs').fs);
jest.mock('fluent-ffmpeg');

const mockProjectsService = {
  getProject: jest.fn().mockResolvedValue({ scenes: [] }),
  updateStatus: jest.fn().mockResolvedValue(undefined),
};

const mockVideoGateway = {
  broadcastProgress: jest.fn(),
};

const mockAiService = {};
const mockQueue = {
  add: jest.fn(),
};

// Mock implementation for fluent-ffmpeg
const mockFfmpeg = {
  input: jest.fn().mockReturnThis(),
  inputOptions: jest.fn().mockReturnThis(),
  complexFilter: jest.fn().mockReturnThis(),
  outputOptions: jest.fn().mockReturnThis(),
  format: jest.fn().mockReturnThis(),
  on: jest.fn((event, callback) => {
    // Immediately trigger 'end' to simulate completion
    if (event === 'end') {
      callback();
    }
    return mockFfmpeg;
  }),
  save: jest.fn().mockReturnThis(),
  kill: jest.fn(),
  pipe: jest.fn().mockReturnThis(),
  ffprobe: jest.fn((filePath, callback) => {
    callback(null, { format: { duration: 10 } });
  }),
};

(ffmpeg as unknown as jest.Mock).mockImplementation(() => mockFfmpeg);
(ffmpeg as any).ffprobe = mockFfmpeg.ffprobe;

describe('VideoService', () => {
  let service: VideoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoService,
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: VideoGateway, useValue: mockVideoGateway },
        { provide: AiService, useValue: mockAiService },
        { provide: getQueueToken('video-render'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<VideoService>(VideoService);

    const tempDir = path.join(process.cwd(), 'temp');
    const assetsDir = path.join(process.cwd(), 'data/music');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'song1.mp3'), 'music data');
  });

  afterEach(() => {
    const tempDir = path.join(process.cwd(), 'temp');
    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir, { recursive: true });
    }
    if (fs.existsSync(dataDir)) {
      fs.rmdirSync(dataDir, { recursive: true });
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMusicList', () => {
    it('should return a list of music files', async () => {
      const musicList = await service.getMusicList();
      expect(musicList).toEqual(['song1.mp3']);
    });
  });

  describe('assembleVideo', () => {
    it('should add job to render queue', async () => {
      const audioFile = { buffer: Buffer.from('narration') } as Express.Multer.File;
      const imageFile = { buffer: Buffer.from('image') } as Express.Multer.File;
      const bgMusicFile = { buffer: Buffer.from('background music') } as Express.Multer.File;

      const promise = service.assembleVideo(audioFile, [imageFile], 10, 'a script', bgMusicFile);

      await promise;

      expect(mockQueue.add).toHaveBeenCalledWith('assemble', expect.any(Object), expect.any(Object));
    });
  });

  describe('processAssembly', () => {
    it('should apply smart ducking when bgMusic is provided', async () => {
      const audioPath = 'audio.wav';
      const imagePaths = ['image.png'];
      const bgMusicPath = 'bgMusic.mp3';
      fs.writeFileSync(audioPath, 'audio data');
      fs.writeFileSync(imagePaths[0], 'image data');
      fs.writeFileSync(bgMusicPath, 'music data');

      jest.spyOn(service as any, 'createClip').mockResolvedValue(undefined);

      const promise = service.processAssembly(audioPath, imagePaths, 10, 'a script', bgMusicPath, 'temp');

      // Fast-forward timers to trigger cleanup
      jest.runAllTimers();

      await promise;

      expect(mockFfmpeg.complexFilter).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ filter: 'sidechaincompress' })
        ])
      );
    });

    it('should NOT apply smart ducking when bgMusic is NOT provided', async () => {
       const audioPath = 'audio.wav';
       const imagePaths = ['image.png'];
       fs.writeFileSync(audioPath, 'audio data');
       fs.writeFileSync(imagePaths[0], 'image data');
       jest.spyOn(service as any, 'createClip').mockResolvedValue(undefined);

       const promise = service.processAssembly(audioPath, imagePaths, 10, 'a script', undefined, 'temp');
       
       jest.runAllTimers();

       await promise;

       const sidechainCall = (mockFfmpeg.complexFilter as jest.Mock).mock.calls.find(call =>
         call[0].some((filter: any) => filter.filter === 'sidechaincompress')
       );
       expect(sidechainCall).toBeUndefined();
    });
  });
});
