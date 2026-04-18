
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResearchService } from './research/research.service';

async function testDownload() {
  console.log('🚀 Iniciando Resgate de Artefato do Google...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ResearchService);
  const id = '05163177-e062-46fc-96d1-b9408545b00d';

  try {
    const result = await service.downloadResearchResult(id);
    console.log('\n✅ SUCESSO NO DOWNLOAD!');
    console.log(result);
  } catch (error) {
    console.error('\n❌ Falha no download:', error.message);
  } finally {
    await app.close();
  }
}

testDownload();
