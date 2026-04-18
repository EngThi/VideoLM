
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProjectsService } from './projects/projects.service';

async function checkProject() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ProjectsService);

  try {
    const projects = await service.findAll();
    console.log(`\n📋 TOTAL DE PROJETOS: ${projects.length}`);
    projects.forEach(p => {
      console.log(`- [${p.id}] ${p.title} | Status: ${p.status} | Sources: ${p.sources?.length || 0}`);
      console.log(`  └─ Metadata: ${JSON.stringify(p.metadata)}`);
      if (p.error) console.log(`  └─ ❌ Erro: ${p.error}`);
    });
  } catch (e) {
    console.error('❌ Erro ao ler projetos:', e.message);
  } finally {
    await app.close();
  }
}
checkProject();
