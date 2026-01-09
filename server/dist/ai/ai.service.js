"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
let AiService = class AiService {
    async generateScript(topic) {
        return `Generated script about: ${topic}\n\nThis is a placeholder. Connect to Gemini API.`;
    }
    async generateImagePrompts(script) {
        return ['Prompt 1', 'Prompt 2', 'Prompt 3'];
    }
    async generateVoiceover(script) {
        return 'path/to/voiceover.mp3';
    }
    async generateImages(prompts) {
        return ['path/to/image1.png', 'path/to/image2.png', 'path/to/image3.png'];
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)()
], AiService);
//# sourceMappingURL=ai.service.js.map