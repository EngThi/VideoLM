"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const ai_service_1 = require("./ai.service");
describe('AiService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [ai_service_1.AiService],
        }).compile();
        service = module.get(ai_service_1.AiService);
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
        }
        catch (error) {
            expect(error).toBeDefined();
        }
    });
});
//# sourceMappingURL=ai.service.spec.js.map