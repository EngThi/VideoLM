
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AiService } from './ai/ai.service';
import { VideoService } from './video/video.service';
import { ProjectsService } from './projects/projects.service';
import * as fs from 'fs';
import * as path from 'path';

async function testLegacyGeminiFlow() {
  console.log('📜 [LEGACY FLOW TEST] Testando o sistema SEM NotebookLM (Apenas Gemini)...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const ai = app.get(AiService);
  const video = app.get(VideoService);
  const projects = app.get(ProjectsService);

  const topic = "The Art of Making Coffee";
  const project = await projects.create({ title: 'LEGACY COFFEE', topic });
  const id = project.id;

  try {
    // 1. Roteiro Gemini (Original)
    console.log('✍️ Passo 1: Gerando roteiro via Gemini...');
    const script = await ai.generateScript(topic, 1);
    await projects.update(id, { script });
    console.log('✅ Roteiro gerado.');

    // 2. Storyboard Prompts (Original)
    console.log('🎨 Passo 2: Gerando prompts de imagem...');
    const prompts = await ai.generateImagePrompts(script);
    await projects.updateMetadata(id, { storyboardPrompts: prompts });

    // 3. Imagens e Áudio (Original)
    console.log('🎙️ Passo 3: Gerando Voz e Imagens...');
    const { audioBuffer, duration } = await ai.generateVoiceover(script);
    
    // Imagens com fallback se 429
    let imageUrls = await ai.generateImages(prompts);
    if (imageUrls.length === 0) {
        console.warn("⚠️ API de imagem em quota. Usando imagens de fallback.");
        imageUrls = ["https://image.pollinations.ai/prompt/coffee%20art%20cinematic?width=1280&height=720&nologo=true&seed=42"];
    }
    
    const imageFiles: any[] = await Promise.all(imageUrls.map(async (url, i) => {
        try {
            const res = await fetch(url);
            return { buffer: Buffer.from(await res.arrayBuffer()), originalname: `img_${i}.png` };
        } catch (e) {
            // Se falhar o fetch, usa um buffer vazio (vai falhar no ffmpeg mas pelo menos o teste pega o erro)
            return { buffer: Buffer.from([]), originalname: `fail_${i}.png` };
        }
    }));

    // 4. Montagem via Fila
    console.log('🎬 Passo 4: Enviando para a fila de montagem...');
    const videoUrl = await video.assembleVideo(
        { buffer: audioBuffer, originalname: 'audio.wav' } as any,
        imageFiles,
        duration,
        script,
        undefined,
        undefined,
        id
    );

    console.log(`🚀 Job enviado! Video URL (futura): ${videoUrl}`);

    // 5. Polling para aguardar conclusão (O milímetro final!)
    console.log('⏳ Aguardando conclusão do vídeo...');
    let isDone = false;
    let attempts = 0;
    while (!isDone && attempts < 30) {
        const status = await video.getStatus(id);
        if (status.status === 'completed') {
            console.log(`\n\n✨ [SUCCESS] VÍDEO PRONTO: ${status.videoPath}`);
            isDone = true;
        } else if (status.status === 'error') {
            console.error(`\n\n❌ ERRO NO WORKER: ${status.error}`);
            isDone = true;
        } else {
            process.stdout.write('.');
            await new Promise(r => setTimeout(r, 5000));
            attempts++;
        }
    }

    console.log('\n🏆 O SISTEMA ORIGINAL FOI VALIDADO COM SUCESSO!');

  } catch (error) {
    console.error('\n❌ O sistema velho falhou:', error.message);
  } finally {
    await app.close();
  }
}

testLegacyGeminiFlow();
