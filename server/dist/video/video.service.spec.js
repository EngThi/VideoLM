"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const video_service_1 = require("./video.service");
const projects_service_1 = require("../projects/projects.service");
const video_gateway_1 = require("./video.gateway");
const typeorm_1 = require("@nestjs/typeorm");
const project_entity_1 = require("../projects/project.entity");
const stream_1 = require("stream");
const child_process = require("child_process");
jest.mock('child_process', () => ({
    exec: jest.fn((cmd, options, callback) => {
        if (typeof options === 'function') {
            options(null, { stdout: '/fake/path/video.mp4', stderr: '' });
        }
        else {
            callback(null, { stdout: '/fake/path/video.mp4', stderr: '' });
        }
    }),
}));
jest.mock('fs', () => {
    const originalFs = jest.requireActual('fs');
    return Object.assign(Object.assign({}, originalFs), { existsSync: jest.fn().mockReturnValue(true), writeFileSync: jest.fn(), mkdirSync: jest.fn(), rmSync: jest.fn() });
});
jest.mock('fluent-ffmpeg', () => {
    const mockFfmpeg = {
        input: jest.fn().mockReturnThis(),
        inputOptions: jest.fn().mockReturnThis(),
        complexFilter: jest.fn().mockReturnThis(),
        outputOptions: jest.fn().mockReturnThis(),
        output: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation(function (event, callback) {
            if (event === 'end') {
                setTimeout(callback, 0);
            }
            return this;
        }),
        run: jest.fn(),
        pipe: jest.fn().mockImplementation((stream) => {
            setTimeout(() => {
                if (stream.emit)
                    stream.emit('end');
                stream.end();
            }, 10);
            return stream;
        }),
    };
    const ffmpeg = jest.fn(() => mockFfmpeg);
    ffmpeg.setFfmpegPath = jest.fn();
    ffmpeg.setFfprobePath = jest.fn();
    ffmpeg.ffprobe = jest.fn((path, cb) => {
        cb(null, { format: { duration: 12 } });
    });
    return ffmpeg;
});
describe('VideoService', () => {
    let service;
    let mockProjectsService;
    let mockVideoGateway;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                video_service_1.VideoService,
                {
                    provide: projects_service_1.ProjectsService,
                    useValue: mockProjectsService,
                },
                {
                    provide: video_gateway_1.VideoGateway,
                    useValue: mockVideoGateway,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(project_entity_1.ProjectEntity),
                    useValue: {},
                },
            ],
        }).compile();
        service = module.get(video_service_1.VideoService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    it('should call broadcastProgress during video assembly', async () => {
        const mockFile = (name) => ({
            fieldname: 'test',
            originalname: name,
            encoding: '7bit',
            mimetype: 'image/png',
            size: 123,
            buffer: Buffer.from('fake-image-data'),
            stream: new stream_1.PassThrough(),
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
        expect(stream).toBeInstanceOf(stream_1.PassThrough);
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
//# sourceMappingURL=video.service.spec.js.map