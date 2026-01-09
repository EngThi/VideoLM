import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectEntity } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a project', async () => {
    const createDto: CreateProjectDto = { title: 'Test Project', topic: 'AI' };
    const projectPayload = {
      title: 'Test Project',
      topic: 'AI',
      status: 'idle',
    };
    const savedProject = { id: '1', ...projectPayload, createdAt: new Date(), updatedAt: new Date() };

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
