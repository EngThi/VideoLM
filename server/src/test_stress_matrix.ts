
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResearchService } from './research/research.service';
import { ProjectsService } from './projects/projects.service';
import { VideoService } from './video/video.service';

async function testMatrixStress() {
  console.log('🔥 [MATRIX STRESS TEST] Iniciando Gauntlet de Elite...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const research = app.get(ResearchService);
  const projects = app.get(ProjectsService);

  const configs = [
    { title: 'STRESS A: HYBRID', topic: 'Quantum Computing Breakthroughs 2026', type: 'hybrid' },
    { title: 'STRESS B: FACTUAL', topic: 'The History of Open Source Software', type: 'factual' },
    { title: 'STRESS C: DATA', topic: 'Global EV Market Share Analysis', type: 'infographic' }
  ];

  try {
    console.log('🚀 Disparando 3 pipelines simultâneos...');
    
    const projectPromises = configs.map(async (cfg) => {
        const p = await projects.create({ title: cfg.title, topic: cfg.topic });
        console.log(`✅ Projeto Criado: ${cfg.title} (${p.id})`);
        
        // Simula a adição de fontes
        await research.addSources(p.id, ['https://en.wikipedia.org/wiki/' + cfg.topic.replace(/ /g, '_')]);
        
        if (cfg.type === 'hybrid') {
            return research.startHybridAbsolutePipeline(p.id);
        } else if (cfg.type === 'factual') {
            return research.startNotebookLMResearch(p.id, 'video', 'classic', { liveResearch: true });
        } else {
            return research.startNotebookLMResearch(p.id, 'infographic', 'clay', { liveResearch: true });
        }
    });

    const results = await Promise.all(projectPromises);
    console.log('\n📡 Todos os gatilhos enviados com sucesso para a fila BullMQ.');
    console.log('📊 Resultados iniciais:', JSON.stringify(results, null, 2));

    console.log('\n⏳ Monitorando Resiliência da VM (Aguardando Jobs na Fila)...');
    
    // Vamos esperar 60s para ver se a VM trava ou se a fila processa um por um
    for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const freeMem = Math.round(require('os').freemem() / 1024 / 1024);
        console.log(`[MONITOR] Memória Livre: ${freeMem}MB | Jobs ativos no Worker...`);
    }

    console.log('\n🏆 MATRIX STRESS TEST FINALIZADO: O sistema sobreviveu ao disparo massivo.');

  } catch (error) {
    console.error('\n❌ O sistema quebrou sob estresse:', error.message);
  } finally {
    await app.close();
  }
}

testMatrixStress();
