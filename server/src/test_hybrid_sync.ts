
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResearchService } from './research/research.service';
import { NotebookLMEngine } from './research/notebook-lm.engine';
import { AiService } from './ai/ai.service';
import * as fs from 'fs';
import * as path from 'path';

async function testHybridSync() {
  console.log('🎬 [HYBRID SYNC TEST] Validando Storytelling + Infográfico B-Roll...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const notebookLM = app.get(NotebookLMEngine);
  const aiService = app.get(AiService);

  const notebookId = '53df3313-ad51-40f0-8725-60eb20561401'; // Notebook de teste com fontes
  const reportPath = path.join(process.cwd(), 'temp', 'hybrid_report.md');
  const infoPath = path.join(process.cwd(), 'public/videos', 'hybrid_bento.png');

  try {
    // 1. Extrair Fatos do NLM
    console.log('📡 Passo 1: Extraindo Report factual do NLM...');
    await notebookLM.createReport(notebookId);
    
    console.log('⏳ Aguardando geração do report (Polling)...');
    let reportReady = false;
    while (!reportReady) {
        const statusRaw = await notebookLM.checkStatus(notebookId);
        const artifacts = JSON.parse(statusRaw);
        const report = artifacts.find((a: any) => a.type === 'report' && a.status === 'completed');
        if (report) {
            reportReady = true;
        } else {
            process.stdout.write('.');
            await new Promise(r => setTimeout(r, 10000));
        }
    }
    console.log('\n✅ Report pronto. Baixando...');
    await notebookLM.downloadReport(notebookId, reportPath);
    const facts = fs.readFileSync(reportPath, 'utf-8');
    console.log(`✅ Fatos extraídos (${facts.length} bytes).`);

    // 2. Storytelling via Gemini
    console.log('\n🎙️ Passo 2: Gemini gerando roteiro "Humano" com marcações de sincronia...');
    const prompt = `
      Contexto Factual (NotebookLM):
      ${facts.slice(0, 3000)}
      
      Tarefa: Escreva um roteiro curto (1 min) para YouTube Shorts.
      O roteiro deve ser cativante e direto.
      IMPORTANTE: Quando for falar de dados técnicos ou estatísticas, envolva o texto entre [TECH_START] e [TECH_END].
      Retorne APENAS o texto do roteiro.
    `;
    const { text: script } = await aiService.generate(prompt);
    console.log('--- ROTEIRO GERADO ---');
    console.log(script);
    console.log('----------------------');

    // 3. Sincronização Lógica
    console.log('\n⚙️ Passo 3: Mapeando momentos para B-Roll (Infográfico)...');
    if (script.includes('[TECH_START]')) {
        const segments = script.split('[TECH_START]');
        const techPart = segments[1].split('[TECH_END]')[0];
        console.log(`📌 Highlight Detectado: "${techPart.trim().slice(0, 50)}..."`);
        console.log(`🚀 Ação: Injetar Infográfico Bento Grid neste momento no FFmpeg.`);
    } else {
        console.log('⚠️ Nenhum highlight técnico detectado. Usando inserção padrão no meio do vídeo.');
    }

    // 4. Download do Infográfico
    console.log('\n🖼️ Passo 4: Baixando Infográfico Bento para o B-Roll...');
    await notebookLM.downloadInfographic(notebookId, infoPath);
    console.log(`✅ Infográfico pronto em: ${infoPath}`);

    console.log('\n✨ TESTE HÍBRIDO CONCLUÍDO COM SUCESSO!');

  } catch (error) {
    console.error('\n❌ Falha no teste híbrido:', error.message);
  } finally {
    await app.close();
  }
}

testHybridSync();
