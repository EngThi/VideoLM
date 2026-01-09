"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const projects_service_1 = require("./projects.service");
const typeorm_1 = require("@nestjs/typeorm");
const project_entity_1 = require("./project.entity");
describe('ProjectsService', () => {
    let service;
    let mockRepository;
    beforeEach(async () => {
        mockRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                projects_service_1.ProjectsService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(project_entity_1.ProjectEntity),
                    useValue: mockRepository,
                },
            ],
        }).compile();
        service = module.get(projects_service_1.ProjectsService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    it('should create a project', async () => {
        const createDto = { title: 'Test Project', topic: 'AI' };
        const projectPayload = {
            title: 'Test Project',
            topic: 'AI',
            status: 'idle',
        };
        const savedProject = Object.assign(Object.assign({ id: '1' }, projectPayload), { createdAt: new Date(), updatedAt: new Date() });
        mockRepository.create.mockReturnValue(projectPayload);
        mockRepository.save.mockResolvedValue(savedProject);
        const result = await service.create(createDto);
        expect(mockRepository.create).toHaveBeenCalledWith(projectPayload);
        expect(mockRepository.save).toHaveBeenCalledWith(projectPayload);
        expect(result).toEqual(savedProject);
    });
    it('should find all projects', async () => {
        const mockProjects = [
            { id: '1', title: 'Test1', topic: 'AI' },
            { id: '2', title: 'Test2', topic: 'ML' },
        ];
        mockRepository.find.mockResolvedValue(mockProjects);
        const result = await service.findAll();
        expect(result).toEqual(mockProjects);
        expect(mockRepository.find).toHaveBeenCalled();
    });
    it('should find one project by id', async () => {
        const mockProject = { id: '1', title: 'Test', topic: 'AI' };
        mockRepository.findOne.mockResolvedValue(mockProject);
        const result = await service.findOne('1');
        expect(result).toEqual(mockProject);
    });
    it('should delete a project', async () => {
        mockRepository.delete.mockResolvedValue({ affected: 1 });
        await service.delete('1');
        expect(mockRepository.delete).toHaveBeenCalledWith('1');
    });
});
//# sourceMappingURL=projects.service.spec.js.map