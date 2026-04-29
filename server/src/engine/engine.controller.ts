import { Controller, Get } from '@nestjs/common';

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://54-162-84-165.sslip.io';

@Controller('api/engine')
export class EngineController {
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
}
