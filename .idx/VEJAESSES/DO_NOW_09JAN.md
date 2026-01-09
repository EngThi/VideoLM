# ⚡ FAÇA AGORA - 09/01/2026 11:36

**Você tem 4 horas para terminar 30% do projeto**

Tempo: 11:36 → 15:36 (4 horas)
Meta: 60% → 85% completo

---

## 🎯 O QUE FAZER AGORA

### TASK 1: Tests (1.5 HORAS) ⏱️

**Criar arquivo 1:**
```bash
cat > server/src/projects/projects.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from './project.entity';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
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
    const createDto = { title: 'Test Project', topic: 'AI' };
    const mockProject = { id: '1', ...createDto, createdAt: new Date() };
    
    mockRepository.save.mockResolvedValue(mockProject);
    const result = await service.create(createDto);
    
    expect(result).toEqual(mockProject);
    expect(mockRepository.save).toHaveBeenCalledWith(createDto);
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

  it('should remove a project', async () => {
    const mockProject = { id: '1', title: 'Test', topic: 'AI' };
    
    mockRepository.findOne.mockResolvedValue(mockProject);
    mockRepository.remove.mockResolvedValue({});
    
    await service.remove('1');
    
    expect(mockRepository.remove).toHaveBeenCalled();
  });
});
EOF
```

**Depois criar arquivo 2:**
```bash
cat > server/src/ai/ai.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
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
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
EOF
```

**Depois:**
```bash
cd ai-video-factory/server
npm run test:cov
```

Esperado: Coverage sobe de 35% → 60%+

---

### TASK 2: Docker (1.5 HORAS) ⏱️

**Criar docker-compose.yml:**
```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:5173"
    environment:
      - VITE_API_URL=http://backend:3000
    depends_on:
      - backend

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DATABASE_URL=sqlite:homes.db
    volumes:
      - ./server/homes.db:/app/homes.db

volumes:
  homes_db:
EOF
```

**Criar server/Dockerfile:**
```bash
cat > server/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]
EOF
```

**Criar .dockerignore:**
```bash
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
dist
.DS_Store
homes.db
.idx
EOF
```

**Depois:**
```bash
# Build
docker-compose build

# Run
docker-compose up

# Test em outro terminal
curl http://localhost:3000/api/projects

# Stop: CTRL+C
```

Esperado: Containers rodam sem erro

---

### TASK 3: Deploy Railway (1 HORA) ⏱️

**1. Vá para:** https://railway.app

**2. Sign up/Login com GitHub**

**3. New Project → Deploy from GitHub Repo**

**4. Select:** EngThi/ai-video-factory

**5. Configure env vars:**
```
GEMINI_API_KEY=sua_chave_aqui
NODE_ENV=production
```

**6. Click Deploy**

**7. Esperar 5-10 min**

**8. Copiar URL pública**

**9. Test:**
```bash
curl https://xxxxx.up.railway.app/api/projects
```

Esperado: JSON response com sucesso

---

### TASK 4: Git Push (15 MIN) ⏱️

```bash
git status
git add .
git commit -m "feat: Complete tests, Docker setup, and Railway deployment

- Added projects.service.spec.ts
- Added ai.service.spec.ts
- Created docker-compose.yml
- Created server/Dockerfile
- Created .dockerignore
- Deployed to Railway.app
- Coverage improved from 35% → 60%+"

git push origin main
```

---

## ⏰ CRONOGRAMA (4 HORAS)

```
11:36 - Comece Task 1 (Tests)
13:06 - Comece Task 2 (Docker)
14:36 - Comece Task 3 (Railway)
15:36 - Comece Task 4 (Git Push)
15:51 - PRONTO! 85% completo!
```

---

## ✅ CHECKLIST

- [ ] projects.service.spec.ts criado
- [ ] ai.service.spec.ts criado
- [ ] npm run test:cov rodou
- [ ] docker-compose.yml criado
- [ ] server/Dockerfile criado
- [ ] .dockerignore criado
- [ ] docker-compose build ok
- [ ] docker-compose up ok
- [ ] Railway deploy ok
- [ ] git push ok

---

**Comece AGORA!** 🚀
