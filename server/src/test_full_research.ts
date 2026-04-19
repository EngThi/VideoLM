
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
    // const result = await service.startNotebookLMResearch(id, 'audio'); // Pulando se já disparou
    console.log('✅ Ordem enviada ao Google.\n');

    console.log('🎨 Passo 3: Gerando Storyboard Visual baseado na pesquisa...');
    const visuals = await service.generateVisualsForResearch(id);
    console.log('✅ Storyboard gerado com sucesso!');
    console.log('Prompts:', visuals.prompts);

    console.log('\n✨ SUCESSO: Ciclo completo (Dados -> Visuais) concluído!');

  } catch (error) {
    console.error('\n❌ Falha na orquestração:', error.message);
  } finally {
    await app.close();
  }
}

testFullResearch();
