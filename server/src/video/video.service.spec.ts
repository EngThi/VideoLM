
import { Test, TestingModule } from '@nestjs/testing';
import { VideoService } from './video.service';
import { ProjectsService } from '../projects/projects.service';
import { VideoGateway } from './video.gateway';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectEntity } from '../projects/project.entity';
import { PassThrough } from 'stream';
import * as child_process from 'child_process';
import * as fs from 'fs';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, options, callback) => {
    if (typeof options === 'function') {
      options(null, { stdout: '/fake/path/video.mp4', stderr: '' });
    } else {
      callback(null, { stdout: '/fake/path/video.mp4', stderr: '' });
    }
  }),
}));

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    existsSync: jest.fn().mockReturnValue(true),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    rmSync: jest.fn(),
  };
});

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = {
    input: jest.fn().mockReturnThis(),
    inputOptions: jest.fn().mockReturnThis(),
    complexFilter: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function(event, callback) {
      if (event === 'end') {
        setTimeout(callback, 0);
      }
      return this;
    }),
    run: jest.fn(),
    pipe: jest.fn().mockImplementation((stream) => {
        setTimeout(() => {
            if (stream.emit) stream.emit('end');
            stream.end();
        }, 10);
        return stream;
    }),
  };
  
  const ffmpeg = jest.fn(() => mockFfmpeg);
  (ffmpeg as any).setFfmpegPath = jest.fn();
  (ffmpeg as any).setFfprobePath = jest.fn();
  (ffmpeg as any).ffprobe = jest.fn((path, cb) => {
    cb(null, { format: { duration: 12 } });
  });

  return ffmpeg;
});

describe('VideoService', () => {
  let service: VideoService;
  let mockProjectsService: Partial<ProjectsService>;
  let mockVideoGateway: Partial<VideoGateway>;

  beforeEach(async () => {
    mockProjectsService = {
      updateStatus: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        id: 'test-id',
        script: 'Line 1.\nLine 2.',
        topic: 'Test Topic',
        status: 'idle'
      }),
    };

    mockVideoGateway = {
      broadcastProgress: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoService,
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: VideoGateway,
          useValue: mockVideoGateway,
        },
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<VideoService>(VideoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call broadcastProgress during video assembly', async () => {
    const mockFile = (name: string): Express.Multer.File => ({
      fieldname: 'test',
      originalname: name,
      encoding: '7bit',
      mimetype: 'image/png',
      size: 123,
      buffer: Buffer.from('fake-image-data'),
      stream: new PassThrough(),
      destination: '',
      filename: '',
      path: ''
    });

    const audioFile = mockFile('audio.wav');
    const imageFiles = [mockFile('img1.png'), mockFile('img2.png')];
    const script = 'This is a test script.';
    const duration = 10;
    
    const stream = await service.assembleVideo(audioFile, imageFiles, duration, script);
    
    expect(mockVideoGateway.broadcastProgress).toHaveBeenCalled();
    expect(stream).toBeInstanceOf(PassThrough);
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(mockVideoGateway.broadcastProgress).toHaveBeenCalledWith('dev-session', 100, 'completed');
  });

  it('should generate video using HOMES-Engine', async () => {
    const result = await service.generateVideo('test-id');
    
    expect(mockProjectsService.updateStatus).toHaveBeenCalledWith('test-id', 'processing');
    expect(child_process.exec).toHaveBeenCalled();
    expect(result.status).toBe('done');
    expect(result.videoPath).toBe('/fake/path/video.mp4');
  });

  it('should get project status', async () => {
    const status = await service.getStatus('test-id');
    expect(status).toHaveProperty('status');
    expect(mockProjectsService.findOne).toHaveBeenCalledWith('test-id');
  });
});
