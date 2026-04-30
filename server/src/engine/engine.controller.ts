import { BadRequestException, Body, Controller, Get, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ResearchService } from '../research/research.service';

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://54-162-84-165.sslip.io';

@Controller('api/engine')
export class EngineController {
  constructor(private readonly researchService: ResearchService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'VideoLM Engine Bridge',
      baseUrl: PUBLIC_BASE_URL,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('manifest')
  manifest() {
    return {
      name: 'VideoLM Factory',
      version: '2026-04-29',
      baseUrl: PUBLIC_BASE_URL,
      contentType: 'application/json',
      capabilities: {
        publicDemoAssembly: true,
        authenticatedAssembly: true,
        notebookLMResearch: true,
        notebookLMProfiles: true,
        notebookLMCookiesBringYourOwn: true,
        notebookLMExistingNotebooks: true,
        fileSourceUpload: true,
        queue: {
          provider: 'BullMQ',
          concurrency: 1,
          behavior: 'FIFO render lane for heavy video jobs',
        },
        cors: 'open',
        engineNotebookLMVideo: true,
        maxUploadMbPerFile: 100,
        maxImagesPerRender: 100,
        maxResearchFilesPerRequest: 12,
      },
      publicEndpoints: {
        health: {
          method: 'GET',
          path: '/api/engine/health',
          url: `${PUBLIC_BASE_URL}/api/engine/health`,
        },
        manifest: {
          method: 'GET',
          path: '/api/engine/manifest',
          url: `${PUBLIC_BASE_URL}/api/engine/manifest`,
        },
        videoDemoHealth: {
          method: 'GET',
          path: '/api/video/demo/health',
          url: `${PUBLIC_BASE_URL}/api/video/demo/health`,
        },
        videoDemoAssemble: {
          method: 'POST',
          path: '/api/video/demo/assemble',
          url: `${PUBLIC_BASE_URL}/api/video/demo/assemble`,
          requestType: 'multipart/form-data',
          fields: {
            audio: { type: 'file', required: true, accepts: ['audio/wav', 'audio/mpeg', 'audio/mp3'] },
            images: { type: 'file[]', required: true, accepts: ['image/png', 'image/jpeg', 'image/webp'], maxCount: 100 },
            bgMusic: { type: 'file', required: false, accepts: ['audio/mpeg', 'audio/mp3', 'audio/wav'] },
            duration: { type: 'number|string', required: false },
            script: { type: 'string', required: false },
            bgMusicId: { type: 'string', required: false },
            projectId: { type: 'string', required: false },
          },
          response: {
            projectId: 'string',
            videoUrl: 'string',
            statusUrl: 'string',
          },
        },
        videoStatus: {
          method: 'GET',
          path: '/api/video/:projectId/status',
          urlTemplate: `${PUBLIC_BASE_URL}/api/video/{projectId}/status`,
        },
        music: {
          method: 'GET',
          path: '/api/video/music',
          url: `${PUBLIC_BASE_URL}/api/video/music`,
        },
        engineNotebookLMVideo: {
          method: 'POST',
          path: '/api/engine/notebooklm/video',
          url: `${PUBLIC_BASE_URL}/api/engine/notebooklm/video`,
          requestType: 'multipart/form-data',
          fields: {
            projectId: { type: 'string', required: false },
            title: { type: 'string', required: false },
            theme: { type: 'string', required: false, description: 'Free-form topic/theme stored with the job and used for liveResearch query context.' },
            urls: { type: 'string|string[]', required: false, description: 'JSON array, newline-separated, or comma-separated https:// sources.' },
            assets: { type: 'file[]', required: false, maxCount: 12, description: 'Documents/assets sent to NotebookLM as file sources.' },
            style: { type: 'string', required: false, default: 'classic' },
            stylePrompt: { type: 'string', required: false, description: 'Required when style is custom.' },
            liveResearch: { type: 'boolean|string', required: false, default: false },
            notebookId: { type: 'string', required: false, description: 'Use an existing NotebookLM notebook instead of creating one.' },
            profileId: { type: 'string', required: false, default: 'default' },
          },
          response: {
            projectId: 'string',
            status: 'submitted',
            pollUrl: `${PUBLIC_BASE_URL}/api/research/{projectId}/download`,
          },
        },
      },
      authenticatedEndpoints: {
        authRegister: { method: 'POST', path: '/api/auth/register', body: { email: 'string', password: 'string' } },
        authLogin: { method: 'POST', path: '/api/auth/login', body: { email: 'string', password: 'string' } },
        videoAssemble: {
          method: 'POST',
          path: '/api/video/assemble',
          auth: 'Bearer JWT',
          requestType: 'multipart/form-data',
          fields: {
            audio: { type: 'file', required: true },
            images: { type: 'file[]', required: true, maxCount: 100 },
            bgMusic: { type: 'file', required: false },
            duration: { type: 'number|string', required: false },
            script: { type: 'string', required: false },
            bgMusicId: { type: 'string', required: false },
            projectId: { type: 'string', required: false },
          },
        },
      },
      researchEndpoints: {
        saveNotebookLMProfile: {
          method: 'POST',
          path: '/api/research/nlm/profiles',
          body: {
            profileId: 'string, defaults to default',
            cookiesJson: 'stringified cookies.json from notebooklm-mcp-cli',
            cookies: 'cookie object/array alternative',
          },
        },
        listNotebookLMProfiles: { method: 'GET', path: '/api/research/nlm/profiles' },
        listNotebookLMNotebooks: {
          method: 'GET',
          path: '/api/research/nlm/notebooks?profileId=default',
        },
        listNotebookLMSources: {
          method: 'GET',
          path: '/api/research/nlm/notebooks/:notebookId/sources?profileId=default',
        },
        addUrlSources: {
          method: 'POST',
          path: '/api/research/:projectId/sources',
          body: { urls: ['https://example.com/source'] },
        },
        addFileSources: {
          method: 'POST',
          path: '/api/research/:projectId/source-files',
          requestType: 'multipart/form-data',
          fields: {
            files: { type: 'file[]', required: true, maxCount: 12 },
            notebookId: { type: 'string', required: true },
            profileId: { type: 'string', required: false },
          },
        },
        triggerNotebookLMVideo: {
          method: 'POST',
          path: '/api/research/:projectId/trigger',
          body: {
            type: 'video',
            style: ['auto_select', 'classic', 'whiteboard', 'watercolor', 'anime', 'kawaii', 'retro_print', 'heritage', 'paper_craft', 'custom'],
            stylePrompt: 'required only when style is custom',
            liveResearch: false,
            notebookId: 'optional existing notebook id',
            profileId: 'optional profile id',
          },
        },
        pollNotebookLMDownload: {
          method: 'GET',
          path: '/api/research/:projectId/download',
        },
        assembleResearchVideo: {
          method: 'POST',
          path: '/api/research/:projectId/assemble',
        },
      },
      integrationNotes: [
        'Always call /api/... endpoints. Frontend routes return HTML.',
        'Use the baseUrl from this manifest instead of hardcoding tunnel URLs.',
        'For reviewer/demo assembly without login, use /api/video/demo/assemble.',
        'For authenticated full app assembly, login first and send Authorization: Bearer <token>.',
      ],
    };
  }

  @Post('notebooklm/video')
  @UseInterceptors(FilesInterceptor('assets', 12, {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), 'temp', 'engine-nlm-assets');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);
      },
    }),
  }))
  async startNotebookLMVideo(
    @UploadedFiles() assets: any[] = [],
    @Body() body: Record<string, any>,
  ) {
    const projectId = body.projectId || `engine_${Date.now()}`;
    const urls = this.parseUrlSources(body.urls);
    const style = body.style || 'classic';
    const profileId = body.profileId || 'default';
    const liveResearch = this.parseBoolean(body.liveResearch);

    if (!urls.length && !assets.length && !body.notebookId) {
      throw new BadRequestException('Send at least one https:// URL, one asset file, or an existing notebookId.');
    }

    if (urls.length) {
      await this.researchService.addSources(projectId, urls);
    }

    await this.researchService.startNotebookLMResearch(projectId, 'video', style, {
      stylePrompt: body.stylePrompt,
      profileId,
      notebookId: body.notebookId,
      liveResearch,
      sourceFiles: assets,
      theme: body.theme,
      title: body.title,
    });

    return {
      projectId,
      status: 'submitted',
      notebookLM: 'video',
      pollUrl: `${PUBLIC_BASE_URL}/api/research/${projectId}/download`,
    };
  }

  private parseUrlSources(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.flatMap(item => this.parseUrlSources(item));

    const text = String(raw).trim();
    if (!text) return [];

    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return this.parseUrlSources(parsed);
      } catch {
        throw new BadRequestException('urls must be a JSON array, newline-separated list, or comma-separated list.');
      }
    }

    return Array.from(new Set(
      text
        .split(/[\n,]/)
        .map(url => url.trim())
        .filter(Boolean),
    ));
  }

  private parseBoolean(raw: unknown): boolean {
    if (raw === true) return true;
    if (typeof raw === 'string') return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
    return false;
  }
}
