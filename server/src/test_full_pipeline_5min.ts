
import 'dotenv/config';
import { AiService } from './ai/ai.service';
import { VideoService } from './video/video.service';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplicationContext } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
    const timestamp = Date.now();
    const testOutputDir = path.join(process.cwd(), `test_run_${timestamp}`);
    const imagesDir = path.join(testOutputDir, 'images');
    
    console.log(`🚀 Starting Robust Pipeline Test (5 Minutes)...`);
    console.log(`📂 All assets will be saved to: ${testOutputDir}`);

    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule);
    const aiService = app.get(AiService);
    const videoService = app.get(VideoService);

    const topic = "A história da inteligência artificial e o futuro da humanidade (Edição Especial Flavortown)";
    const durationMinutes = 2;

    try {
        // 1. Generate Script
        console.log('📜 Stage 1: Obtaining script...');
        const script = await aiService.generateScript(topic, durationMinutes);
        fs.writeFileSync(path.join(testOutputDir, 'script.txt'), script);
        console.log(`✅ Script saved.`);

        // 2. Generate Image Prompts
        console.log('🎨 Stage 2: Obtaining image prompts...');
        const imagePrompts = await aiService.generateImagePrompts(script);
        fs.writeFileSync(path.join(testOutputDir, 'prompts.json'), JSON.stringify(imagePrompts, null, 2));
        console.log(`✅ ${imagePrompts.length} prompts saved.`);

        // 3. Generate Image URLs
        console.log('🖼️ Stage 3: Obtaining images (using cache/rotation)...');
        const imageUrls = await aiService.generateImages(imagePrompts);
        console.log(`✅ ${imageUrls.length} image URLs obtained.`);

        // 4. Generate Audio (TTS)
        console.log('🎙️ Stage 4: Obtaining voiceover (Gemini TTS)...');
        const { audioBuffer, duration } = await aiService.generateVoiceover(script);
        fs.writeFileSync(path.join(testOutputDir, 'narration.wav'), audioBuffer);
        console.log(`✅ Audio saved. Duration: ${duration.toFixed(2)}s`);

        // 5. Download and Persist Images
        console.log('📥 Stage 5: Downloading and saving images locally...');
        const imageBuffers = await aiService.downloadImages(imageUrls);
        const imageFiles = imageBuffers.map((buffer, i) => {
            const fileName = `img_${i.toString().padStart(3, '0')}.png`;
            const filePath = path.join(imagesDir, fileName);
            fs.writeFileSync(filePath, buffer);
            return {
                buffer,
                originalname: fileName,
                mimetype: 'image/png',
            };
        }) as any[];
        console.log(`✅ All ${imageFiles.length} images saved to /images folder.`);

        // 6. Assemble Video (Using the new persistence mode)
        console.log('🎬 Stage 6: Assembling final video (FFmpeg) - Persisting intermediate clips...');
        const audioFile = {
            buffer: audioBuffer,
            originalname: 'audio.wav',
            mimetype: 'audio/wav',
        } as any;

        // Note: We pass testOutputDir as externalTempDir to keep clips/srt/etc.
        const videoStream = await videoService.assembleVideo(
            audioFile,
            imageFiles,
            duration,
            script,
            null,
            testOutputDir 
        );

        const outPath = path.join(testOutputDir, 'final_video_5min.mp4');
        const fileStream = fs.createWriteStream(outPath);
        
        videoStream.pipe(fileStream);

        return new Promise((resolve, reject) => {
            fileStream.on('finish', () => {
                console.log(`\n✨ SUCCESS!`);
                console.log(`🎥 Video: ${outPath}`);
                console.log(`📂 Individual Assets: ${testOutputDir}`);
                resolve(true);
            });
            fileStream.on('error', (err) => {
                console.error('❌ Error writing video file:', err);
                reject(err);
            });
        });

    } catch (error) {
        console.error('❌ Pipeline failed:', error);
    } finally {
        await app.close();
        process.exit(0);
    }
}

runTest();
