"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const video_service_1 = require("./video.service");
const projects_service_1 = require("../projects/projects.service");
const video_gateway_1 = require("./video.gateway");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
jest.useFakeTimers();
jest.mock('fs', () => require('memfs').fs);
jest.mock('fluent-ffmpeg');
const mockProjectsService = {
    getProject: jest.fn().mockResolvedValue({ scenes: [] }),
};
const mockVideoGateway = {
    broadcastProgress: jest.fn(),
};
const mockFfmpeg = {
    input: jest.fn().mockReturnThis(),
    inputOptions: jest.fn().mockReturnThis(),
    complexFilter: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn((event, callback) => {
        if (event === 'end') {
            callback();
        }
        return mockFfmpeg;
    }),
    pipe: jest.fn().mockReturnThis(),
    ffprobe: jest.fn((filePath, callback) => {
        callback(null, { format: { duration: 10 } });
    }),
};
ffmpeg.mockImplementation(() => mockFfmpeg);
ffmpeg.ffprobe = mockFfmpeg.ffprobe;
describe('VideoService', () => {
    let service;
    beforeEach(async () => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        const module = await testing_1.Test.createTestingModule({
            providers: [
                video_service_1.VideoService,
                { provide: projects_service_1.ProjectsService, useValue: mockProjectsService },
                { provide: video_gateway_1.VideoGateway, useValue: mockVideoGateway },
            ],
        }).compile();
        service = module.get(video_service_1.VideoService);
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
        it('should apply smart ducking when bgMusic is provided', async () => {
            const audioFile = { buffer: Buffer.from('narration') };
            const imageFile = { buffer: Buffer.from('image') };
            const bgMusicFile = { buffer: Buffer.from('background music') };
            jest.spyOn(service, 'createClip').mockResolvedValue();
            const promise = service.assembleVideo(audioFile, [imageFile], 10, 'a script', bgMusicFile);
            jest.runAllTimers();
            await promise;
            expect(mockFfmpeg.complexFilter).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ filter: 'sidechaincompress' })
            ]));
        });
        it('should NOT apply smart ducking when bgMusic is NOT provided', async () => {
            const audioFile = { buffer: Buffer.from('narration') };
            const imageFile = { buffer: Buffer.from('image') };
            jest.spyOn(service, 'createClip').mockResolvedValue();
            const promise = service.assembleVideo(audioFile, [imageFile], 10, 'a script');
            jest.runAllTimers();
            await promise;
            const sidechainCall = mockFfmpeg.complexFilter.mock.calls.find(call => call[0].some((filter) => filter.filter === 'sidechaincompress'));
            expect(sidechainCall).toBeUndefined();
        });
    });
});
//# sourceMappingURL=video.service.spec.js.map