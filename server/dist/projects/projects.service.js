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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const project_entity_1 = require("./project.entity");
let ProjectsService = class ProjectsService {
    constructor(projectRepo) {
        this.projectRepo = projectRepo;
    }
    async create(createProjectDto) {
        const project = this.projectRepo.create({
            title: createProjectDto.title,
            topic: createProjectDto.topic,
            status: 'idle',
        });
        return this.projectRepo.save(project);
    }
    async findOne(id) {
        const project = await this.projectRepo.findOne({ where: { id } });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${id} not found`);
        }
        return project;
    }
    async findAll() {
        return this.projectRepo.find({ order: { createdAt: 'DESC' } });
    }
    async updateStatus(id, status, videoPath, error) {
        const project = await this.findOne(id);
        project.status = status;
        if (videoPath)
            project.videoPath = videoPath;
        if (error)
            project.error = error;
        return this.projectRepo.save(project);
    }
    async delete(id) {
        const result = await this.projectRepo.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Project ${id} not found`);
        }
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map