
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResearchService } from './research/research.service';

async function testFullResearch() {
  console.log('🚀 Iniciando Ciclo de Pesquisa Profunda...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ResearchService);
  const id = '05163177-e062-46fc-96d1-b9408545b00d';

  try {
    console.log(`📡 Passo 1: Injetando fontes para o projeto ${id}...`);
    await service.addSources(id, [
      'https://en.wikipedia.org/wiki/SaaS',
      'https://en.wikipedia.org/wiki/Artificial_intelligence'
    ]);
    console.log('✅ Fontes persistidas no banco.\n');

    console.log('🎙️ Passo 2: Disparando motor NotebookLM (Deep Dive)...');
    // ATENÇÃO: Mudando para modo VIDEO nativo para testar a versão "melhor" que você pediu
    const result = await service.startNotebookLMResearch(id, 'video', 'watercolor');
    console.log('✅ Ordem de VÍDEO CINEMÁTICO (Watercolor) enviada ao Google.\n');

    console.log('⏳ Monitorando progresso no Google Studio...');
    let isDone = false;
    
    while (!isDone) {
      await new Promise(r => setTimeout(r, 20000)); // Vídeo demora mais, checa a cada 20s
      const res = await service.downloadResearchResult(id);
      process.stdout.write(`\r📡 Status no Google: [${res.status}]   `);
      
      if (res.status === 'completed') {
        console.log(`\n\n✅ VÍDEO CINEMÁTICO PRONTO: ${res.videoUrl}`);
        isDone = true;
      } else if (res.status === 'error') {
        console.error(`\n\n❌ ERRO NA GERAÇÃO GOOGLE: ${res.message}`);
        isDone = true;
      }
    }

    console.log('\n✨ PONTO DE ENTREGA ALCANÇADO: Versão Premium de Vídeo Ativada!');

  } catch (error) {
    console.error('\n❌ Falha na orquestração:', error.message);
  } finally {
    await app.close();
  }
}

testFullResearch();
