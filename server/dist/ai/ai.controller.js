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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const video_service_1 = require("../video/video.service");
let AiController = class AiController {
    constructor(aiService, videoService) {
        this.aiService = aiService;
        this.videoService = videoService;
    }
    generateScript({ topic }) {
        return this.aiService.generateScript(topic);
    }
    generateIdeas({ topic }) {
        return this.aiService.generateContentIdeas(topic);
    }
    generateImagePrompts({ script }) {
        return this.aiService.generateImagePrompts(script);
    }
    async generateImage({ prompt, options }) {
        return this.aiService.generateSingleImage(prompt, options);
    }
    async generateVideo({ topic }, res) {
        const script = await this.aiService.generateScript(topic);
        const imagePrompts = await this.aiService.generateImagePrompts(script);
        const imageUrls = await this.aiService.generateImages(imagePrompts);
        const { audioBuffer, duration } = await this.aiService.generateVoiceover(script);
        const imageBuffers = await this.aiService.downloadImages(imageUrls);
        const imageFiles = imageBuffers.map((buffer, i) => ({
            buffer,
            originalname: `image-${i}.jpg`,
            mimetype: 'image/jpeg',
        }));
        const audioFile = {
            buffer: audioBuffer,
            originalname: 'audio.wav',
            mimetype: 'audio/wav',
        };
        const videoStream = await this.videoService.assembleVideo(audioFile, imageFiles, duration, script, null);
        res.set({
            'Content-Type': 'video/mp4',
            'Content-Disposition': 'attachment; filename="video.mp4"',
        });
        videoStream.pipe(res);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('script'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "generateScript", null);
__decorate([
    (0, common_1.Post)('ideas'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "generateIdeas", null);
__decorate([
    (0, common_1.Post)('image-prompts'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "generateImagePrompts", null);
__decorate([
    (0, common_1.Post)('image'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateImage", null);
__decorate([
    (0, common_1.Post)('generate-video'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateVideo", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('api/ai'),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        video_service_1.VideoService])
], AiController);
//# sourceMappingURL=ai.controller.js.map