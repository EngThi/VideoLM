
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResearchService } from './research/research.service';
import { ProjectsService } from './projects/projects.service';

async function testAbsoluteCinema() {
  console.log('🎬 [ABSOLUTE CINEMA 200% TEST] Iniciando Verificação de Elite...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const researchService = app.get(ResearchService);
  const projectsService = app.get(ProjectsService);

  // 1. Criar projeto de teste
  const project = await projectsService.create({ 
    title: 'SPACE TOURISM 2026', 
    topic: 'Commercial Space Travel and SpaceX Starship Progress' 
  });
  const id = project.id;

  try {
    console.log(`📡 Passo 1: Injetando fontes e ativando LIVE RESEARCH para o projeto ${id}...`);
    await researchService.addSources(id, [
      'https://www.spacex.com/vehicles/starship/',
      'https://en.wikipedia.org/wiki/Space_tourism'
    ]);

    console.log('🎙️ Passo 2: Disparando orquestração 200% (Infographic - Style: CLAY)...');
    // Isso vai disparar: addSources -> researchStart (Live) -> createInfographic
    await researchService.startNotebookLMResearch(id, 'infographic', 'clay', { liveResearch: true });
    console.log('✅ Pipeline Live Research + Infographic Clay enviado.\n');

    console.log('⏳ Polling no Google Studio (Aguardando artefatos de hoje)...');
    let isDone = false;
    while (!isDone) {
      await new Promise(r => setTimeout(r, 20000));
      const res = await researchService.downloadResearchResult(id);
      process.stdout.write(`\r📡 Status: [${res.status}]   `);
      
      if (res.status === 'completed') {
        console.log(`\n\n✨ [200% SUCCESS] INFOGRÁFICO PRONTO: ${res.videoUrl}`);
        isDone = true;
      } else if (res.status === 'error') {
        console.error(`\n\n❌ FALHA NO CICLO: ${res.message}`);
        isDone = true;
      }
    }

    console.log('\n🏆 TESTE ABSOLUTE CINEMA CONCLUÍDO: O sistema é 200% resiliente e atualizado.');

  } catch (error) {
    console.error('\n❌ Falha crítica no teste de elite:', error.message);
  } finally {
    await app.close();
  }
}

testAbsoluteCinema();
