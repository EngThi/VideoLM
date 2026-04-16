
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotebookLMEngine } from './research/notebook-lm.engine';

async function testNLM() {
  console.log('🚀 Iniciando Teste do Motor NotebookLM...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const engine = app.get(NotebookLMEngine);

  try {
    console.log('📡 Chamando "nlm list" via TypeScript...');
    const result = await engine.listNotebooks();
    
    console.log('\n✅ Resposta do Motor:');
    console.log(result);
    
    if (result.includes('"id"') || result.includes('ID') || result.includes('Name')) {
      console.log('\n✨ Sucesso: Conexão com NotebookLM estabelecida e dados recuperados!');
    } else {
      console.log('\n⚠️  O motor respondeu, mas parece que não há notebooks ou o login é necessário.');
      console.log('💡 Dica: Se aparecer erro de Auth, rode "/home/user/.local/bin/uvx --from notebooklm-mcp-cli nlm auth" no terminal.');
    }
  } catch (error) {
    console.error('\n❌ Falha crítica ao chamar o motor:', error.message);
  } finally {
    await app.close();
  }
}

testNLM();
