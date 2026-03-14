"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const ai_service_1 = require("./ai.service");
const common_1 = require("@nestjs/common");
describe('AiService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [ai_service_1.AiService],
        }).compile();
        service = module.get(ai_service_1.AiService);
        jest.spyOn(common_1.Logger.prototype, 'log').mockImplementation(() => { });
        jest.spyOn(common_1.Logger.prototype, 'warn').mockImplementation(() => { });
        jest.spyOn(common_1.Logger.prototype, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    it('should generate a script', async () => {
        const generateSpy = jest.spyOn(service, 'generate').mockResolvedValue({
            text: 'This is a test script.',
            provider: 'gemini',
        });
        const script = await service.generateScript('a test topic');
        expect(script).toEqual('This is a test script.');
        expect(generateSpy).toHaveBeenCalled();
    });
    it('should generate image prompts from a script', async () => {
        const mockPrompts = ['prompt 1', 'prompt 2', 'prompt 3', 'prompt 4', 'prompt 5'];
        const generateSpy = jest.spyOn(service, 'generate').mockResolvedValue({
            text: JSON.stringify(mockPrompts),
            provider: 'gemini',
        });
        const prompts = await service.generateImagePrompts('some script');
        expect(prompts).toEqual(mockPrompts);
        expect(generateSpy).toHaveBeenCalled();
    });
    it('should fallback to OpenRouter if Gemini fails', async () => {
        const generateSpy = jest.spyOn(service, 'generate').mockResolvedValue({
            text: 'Fallback script',
            provider: 'openrouter',
        });
        const result = await service.generate('a prompt');
        expect(result.provider).toEqual('openrouter');
        expect(result.text).toEqual('Fallback script');
        expect(generateSpy).toHaveBeenCalled();
    });
    it('should generate correct number of image URLs from Pollinations', async () => {
        const prompts = ['p1', 'p2', 'p3'];
        const urls = await service.generateImages(prompts);
        expect(urls).toHaveLength(prompts.length);
        expect(urls[0]).toContain('https://image.pollinations.ai/prompt/p1');
    });
});
//# sourceMappingURL=ai.service.spec.js.map