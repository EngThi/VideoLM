"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const video_service_1 = require("./video.service");
const path = require("path");
const fs = require("fs");
let VideoController = class VideoController {
    constructor(videoService) {
        this.videoService = videoService;
    }
    async getMusicList() {
        return this.videoService.getMusicList();
    }
    async assembleVideo(files, body, res) {
        var _a, _b;
        let bgMusicFile = (_a = files.bgMusic) === null || _a === void 0 ? void 0 : _a[0];
        if (!bgMusicFile && body.bgMusicId) {
            const musicPath = path.join(process.cwd(), 'data/music', body.bgMusicId);
            if (fs.existsSync(musicPath)) {
                const buffer = fs.readFileSync(musicPath);
                bgMusicFile = {
                    buffer,
                    originalname: body.bgMusicId,
                    mimetype: 'audio/mpeg',
                    fieldname: 'bgMusic',
                    encoding: '7bit',
                    size: buffer.length,
                    stream: null,
                    destination: '',
                    filename: '',
                    path: ''
                };
            }
        }
        const videoStream = await this.videoService.assembleVideo((_b = files.audio) === null || _b === void 0 ? void 0 : _b[0], files.images || [], parseFloat(body.duration || '0'), body.script, bgMusicFile);
        res.set({
            'Content-Type': 'video/mp4',
            'Content-Disposition': 'attachment; filename="video.mp4"',
        });
        videoStream.pipe(res);
    }
    generateVideo(projectId, { theme }) {
        return this.videoService.generateVideo(projectId, theme);
    }
    getStatus(projectId) {
        return this.videoService.getStatus(projectId);
    }
};
exports.VideoController = VideoController;
__decorate([
    (0, common_1.Get)('music'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VideoController.prototype, "getMusicList", null);
__decorate([
    (0, common_1.Post)('assemble'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'audio', maxCount: 1 },
        { name: 'bgMusic', maxCount: 1 },
        { name: 'images', maxCount: 20 },
    ])),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], VideoController.prototype, "assembleVideo", null);
__decorate([
    (0, common_1.Post)(':projectId/generate'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VideoController.prototype, "generateVideo", null);
__decorate([
    (0, common_1.Get)(':projectId/status'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VideoController.prototype, "getStatus", null);
exports.VideoController = VideoController = __decorate([
    (0, common_1.Controller)('api/video'),
    __metadata("design:paramtypes", [video_service_1.VideoService])
], VideoController);
//# sourceMappingURL=video.controller.js.map