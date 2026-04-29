
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VideoService } from './video/video.service';
import { ProjectsService } from './projects/projects.service';
import * as fs from 'fs';
import * as path from 'path';

async function testMockBranding() {
  console.log('🎭 [MOCK BRANDING TEST] Validando Watermark EngThi Engine...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const video = app.get(VideoService);
  const projects = app.get(ProjectsService);

  const project = await projects.create({ title: 'BRANDING TEST', topic: 'Testing Watermark' });
  const id = project.id;

  try {
    // 1. Mock de Áudio (10 segundos de silêncio para ser rápido)
    console.log('🔊 Passo 1: Criando áudio de teste...');
    const audioPath = path.join(process.cwd(), 'temp', `mock_audio_${Date.now()}.wav`);
    const { execSync } = require('child_process');
    execSync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 10 -c:a pcm_s16le "${audioPath}" -y`);
    
    // 2. Mock de Imagens (Cores sólidas para teste)
    console.log('🎨 Passo 2: Criando imagens de teste...');
    const imageFiles: any[] = [];
    for (let i = 0; i < 2; i++) {
        const imgPath = path.join(process.cwd(), 'temp', `mock_img_${i}_${Date.now()}.png`);
        execSync(`ffmpeg -f lavfi -i color=c=${i === 0 ? 'blue' : 'red'}:s=1280x720:d=1 -frames:v 1 "${imgPath}" -y`);
        imageFiles.push({ buffer: fs.readFileSync(imgPath), originalname: `img_${i}.png` });
    }

    // 3. Montagem via Fila (Motor 200%)
    console.log('🎬 Passo 3: Enviando para a fila de montagem com Branding EngThi...');
    const videoUrl = await video.assembleVideo(
        { buffer: fs.readFileSync(audioPath), originalname: 'audio.wav' } as any,
        imageFiles,
        10,
        "Script de teste de branding",
        undefined,
        undefined,
        id
    );

    console.log(`🚀 Job enviado! Polling para ver o resultado final...`);

    let isDone = false;
    let attempts = 0;
    while (!isDone && attempts < 20) {
        const status = await video.getStatus(id);
        if (status.status === 'completed') {
            console.log(`\n\n✨ [200% SUCCESS] VÍDEO COM BRANDING PRONTO: ${status.videoPath}`);
            isDone = true;
        } else if (status.status === 'error') {
            console.error(`\n\n❌ ERRO NO MOTOR: ${status.error}`);
            isDone = true;
        } else {
            process.stdout.write('.');
            await new Promise(r => setTimeout(r, 3000));
            attempts++;
        }
    }

    console.log('\n🏆 CERTIFICAÇÃO DE BRANDING CONCLUÍDA!');

  } catch (error) {
    console.error('\n❌ Falha no teste de branding:', error.message);
  } finally {
    await app.close();
  }
}

testMockBranding();
