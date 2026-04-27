/**
 * Demo Controller — sem autenticação
 *
 * Exposto APENAS para demonstração pública e reviewers do Hack Club Flavortown.
 * Aceita o mesmo payload do /api/video/assemble mas sem @UseGuards(JwtAuthGuard).
 *
 * Para desabilitar em produção, basta remover este arquivo e atualizar o VideoModule.
 */
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideoService } from './video.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api/video/demo')
export class VideoDemoController {
  private readonly logger = new Logger(VideoDemoController.name);

  constructor(private videoService: VideoService) {}

  /**
   * GET /api/video/demo/health
   * Verifica se o VideoLM está pronto para receber jobs do Engine.
   */
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'VideoLM Demo Bridge',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /api/video/demo/assemble
   *
   * Recebe:
   *   - audio       : arquivo .wav da narração (obrigatório)
   *   - images[]    : imagens de cena .jpg/.png (obrigatório, máx 100)
   *   - script      : texto completo (para legendas SRT)
   *   - bgMusicId   : nome do arquivo em data/music/ (opcional)
   *   - projectId   : ID do projeto no Engine (opcional, gera automaticamente)
   *
   * Retorna:
   *   { message, projectId, videoUrl }
   *
   * O vídeo é montado de forma assíncrona via BullMQ.
   * Use GET /api/video/:projectId/status para acompanhar.
   */
  @Post('assemble')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audio', maxCount: 1 },
        { name: 'images', maxCount: 100 },
      ],
      {
        limits: {
          fileSize: 100 * 1024 * 1024, // 100 MB por arquivo
          fieldSize: 100 * 1024 * 1024,
        },
      },
    ),
  )
  async assembleDemo(
    @UploadedFiles()
    files: {
      audio?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Body()
    body: {
      duration?: string;
      script?: string;
      bgMusicId?: string;
      projectId?: string;
    },
  ) {
    const projectId = body.projectId || `demo_${Date.now()}`;

    this.logger.log(`🎬 [DEMO] Assemble request — project: ${projectId}`);
    this.logger.log(`   Audio : ${files.audio?.[0]?.originalname ?? 'MISSING'}`);
    this.logger.log(`   Images: ${files.images?.length ?? 0}`);
    this.logger.log(`   Music : ${body.bgMusicId || 'none'}`);

    if (!files.audio?.[0] || !files.images?.length) {
      throw new BadRequestException(
        'audio (WAV) e pelo menos uma image são obrigatórios',
      );
    }

    // Resolve música de fundo pelo ID (arquivo local em data/music/)
    let bgMusicFile: Express.Multer.File | undefined;
    if (body.bgMusicId) {
      const musicPath = path.join(process.cwd(), 'data/music', body.bgMusicId);
      if (fs.existsSync(musicPath)) {
        const buffer = fs.readFileSync(musicPath);
        bgMusicFile = {
          buffer,
          originalname: body.bgMusicId,
          mimetype: 'audio/mpeg',
          fieldname: 'bgMusic',
          encoding: '7bit',
          size: buffer.length,
          stream: null as any,
          destination: '',
          filename: '',
          path: '',
        };
        this.logger.log(`🎵 Música de fundo: ${body.bgMusicId} (${buffer.length} bytes)`);
      } else {
        this.logger.warn(`⚠️  Música não encontrada: ${musicPath}`);
      }
    }

    const videoUrl = await this.videoService.assembleVideo(
      files.audio[0],
      files.images,
      parseFloat(body.duration || '0'),
      body.script,
      bgMusicFile,
      undefined,
      projectId,
    );

    return {
      message: 'Video assembly queued — use /status to track progress',
      projectId,
      videoUrl,
      statusUrl: `/api/video/${projectId}/status`,
    };
  }
}
