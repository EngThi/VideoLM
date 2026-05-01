import React, { useEffect, useMemo, useState } from 'react';
import {
  getBaseUrl,
  getDemoHealth,
  getEngineHealth,
  getManifest,
  pollNotebookLM,
  pollVideoStatus,
  resolveVideoUrl,
  verifyPlayableMp4,
  type EngineManifest,
} from '../services/engineApi';

type DemoStatus = {
  status?: string;
  progress?: number | null;
  stage?: string;
  currentFrame?: number | null;
  currentClip?: number | null;
  totalClips?: number | null;
  videoUrl?: string;
  videoPath?: string;
  error?: string | null;
};

type HealthState = {
  engine?: any;
  demo?: any;
  manifest?: EngineManifest;
  error?: string;
};

const demoThemes = [
  {
    id: 'hackclub',
    label: 'Hack Club',
    script: 'Hack Club is a community where teenagers build real projects, learn in public, and ship creative technology with friends.',
  },
  {
    id: 'longevity',
    label: 'Longevity',
    script: 'Small daily systems compound over time. Sleep, movement, nutrition, and measurement turn health into an engineering loop.',
  },
  {
    id: 'homelab',
    label: 'Home Lab',
    script: 'A home lab turns spare hardware into a practical cloud, with services, observability, automation, and experiments that keep running.',
  },
];

const preRenderedVideos = [
  {
    title: 'Hack Club NotebookLM render',
    detail: 'Heavier Hack Club MP4 with NotebookLM visuals and branding mask',
    url: '/videos/research_codex_video_trim_mask_1777661325.mp4',
  },
  {
    title: 'One minute branded render',
    detail: 'Standard VideoLM assembly path',
    url: '/videos/one_minute_brand_demo_1777509382_1777509382929.mp4',
  },
];

const notebookStyles = ['classic', 'whiteboard', 'watercolor', 'anime', 'kawaii', 'retro_print', 'heritage', 'paper_craft', 'custom'];

const makeToneWav = (seconds: number) => {
  const sampleRate = 22050;
  const sampleCount = Math.floor(sampleRate * seconds);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const wave = Math.sin(2 * Math.PI * 180 * t) * 0.16 + Math.sin(2 * Math.PI * 240 * t) * 0.07;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, wave)) * 0x7fff, true);
  }

  return new File([buffer], 'demo-narration.wav', { type: 'audio/wav' });
};

const makeDemoImage = async (theme: string, index: number, total: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');

  const palettes = [
    ['#101418', '#33d6a6', '#f7c948'],
    ['#121826', '#338eda', '#ec3750'],
    ['#16130f', '#f7c948', '#ffffff'],
  ];
  const [bg, accent, ink] = palettes[index % palettes.length];

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, canvas.width, 18);
  ctx.fillRect(0, canvas.height - 18, canvas.width, 18);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 9; i += 1) {
    ctx.fillRect(80 + i * 64, 250 + ((i + index) % 4) * 90, 34, 360);
  }

  ctx.fillStyle = ink;
  ctx.font = '700 34px monospace';
  ctx.fillText('LM ENGINE', 72, 128);
  ctx.font = '800 58px Arial';
  ctx.fillText(theme, 72, 245);
  ctx.font = '600 30px Arial';
  ctx.fillText(`Scene ${index + 1} / ${total}`, 72, 330);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.strokeRect(72, 390, 576, 420);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 38px Arial';
  ctx.fillText('Hosted render', 118, 500);
  ctx.fillText('Public MP4 output', 118, 570);
  ctx.fillText('Fallback gallery', 118, 640);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Failed to create image.')), 'image/png');
  });
  return new File([blob], `demo-scene-${index + 1}.png`, { type: 'image/png' });
};

export const EngineDemoPage: React.FC = () => {
  const [themeId, setThemeId] = useState(demoThemes[0].id);
  const [health, setHealth] = useState<HealthState>({});
  const [status, setStatus] = useState<DemoStatus>({});
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [notebookProjectId, setNotebookProjectId] = useState('engine_hackclub_demo');
  const [notebookTitle, setNotebookTitle] = useState('Hack Club community');
  const [notebookTheme, setNotebookTheme] = useState('Hack Club community');
  const [notebookUrls, setNotebookUrls] = useState('https://hackclub.com/');
  const [notebookStyle, setNotebookStyle] = useState('paper_craft');
  const [notebookStylePrompt, setNotebookStylePrompt] = useState('');
  const [notebookId, setNotebookId] = useState('');
  const [profileId, setProfileId] = useState('default');
  const [liveResearch, setLiveResearch] = useState(false);
  const [notebookAssets, setNotebookAssets] = useState<FileList | null>(null);
  const [notebookStatus, setNotebookStatus] = useState<DemoStatus>({});
  const [isNotebookSubmitting, setIsNotebookSubmitting] = useState(false);

  const theme = useMemo(() => demoThemes.find(item => item.id === themeId) || demoThemes[0], [themeId]);
  const baseUrl = getBaseUrl(health.manifest);
  const absoluteVideoUrl = resolveVideoUrl(baseUrl, videoUrl);
  const queueConcurrency = health.manifest?.capabilities?.queue?.concurrency ?? 1;

  const log = (message: string) => setLogs(prev => [...prev, message].slice(-120));

  useEffect(() => {
    let mounted = true;
    Promise.all([getEngineHealth(), getDemoHealth(), getManifest()])
      .then(([engine, demo, manifest]) => {
        if (mounted) setHealth({ engine, demo, manifest });
      })
      .catch((error: any) => {
        if (mounted) setHealth({ error: error.message });
      });
    return () => { mounted = false; };
  }, []);

  const pollStatus = async (projectId: string) => {
    for (let i = 0; i < 90; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const data = await pollVideoStatus(projectId);
      setStatus(data);
      log(`status: ${data.stage || data.status} ${data.progress ?? 0}%`);

      if (data.status === 'completed') {
        const finalUrl = resolveVideoUrl(baseUrl, data.videoUrl || data.videoPath || '');
        if (!finalUrl) throw new Error('Render completed but no videoUrl/videoPath was returned.');

        log('verifying mp4...');
        await verifyPlayableMp4(finalUrl);
        setVideoUrl(finalUrl);
        setStatus({ ...data, videoUrl: finalUrl });
        log(`mp4 verified: ${finalUrl}`);
        log('$ open output.mp4');
        return;
      }

      if (data.status === 'error' || data.status === 'failed') {
        throw new Error(data.error || 'Render failed.');
      }
    }

    throw new Error('Demo render is still running. Use the pre-rendered gallery while the queue finishes.');
  };

  const generateDemo = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus({ status: 'processing', stage: 'opening_curated_hackclub_render', progress: 95 });
    setVideoUrl('');
    setLogs([]);

    try {
      log('$ homes-engine demo');
      log('mode: curated Hack Club reviewer render');
      await openGalleryVideo(preRenderedVideos[0].url);
    } catch (error: any) {
      setStatus(prev => ({ ...prev, status: 'failed', stage: 'failed', error: error.message }));
      log(`error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseNotebookUrls = () => notebookUrls.split('\n').map(url => url.trim()).filter(Boolean);

  const submitNotebookVideo = async () => {
    if (isNotebookSubmitting) return;
    const urls = parseNotebookUrls();
    const invalidUrl = urls.find(url => !url.startsWith('https://'));
    if (invalidUrl) {
      setNotebookStatus({ status: 'failed', stage: 'validation', error: `URL must start with https://: ${invalidUrl}` });
      return;
    }
    if (notebookStyle === 'custom' && !notebookStylePrompt.trim()) {
      setNotebookStatus({ status: 'failed', stage: 'validation', error: 'Custom style requires a style prompt.' });
      return;
    }
    if (!urls.length && !notebookAssets?.length && !notebookId.trim()) {
      setNotebookStatus({ status: 'failed', stage: 'validation', error: 'Send at least one https:// URL, one asset, or an existing notebookId.' });
      return;
    }

    const projectId = notebookProjectId.trim() || `engine_nlm_${Date.now()}`;
    setNotebookProjectId(projectId);
    setNotebookStatus({ status: 'queued', stage: 'submitting', progress: 0 });
    setIsNotebookSubmitting(true);
    setVideoUrl('');

    try {
      const body = new FormData();
      body.append('projectId', projectId);
      body.append('title', notebookTitle);
      body.append('theme', notebookTheme);
      body.append('style', notebookStyle);
      body.append('format', 'brief');
      body.append('profileId', profileId || 'default');
      body.append('liveResearch', String(liveResearch));
      if (notebookId.trim()) body.append('notebookId', notebookId.trim());
      if (notebookStyle === 'custom') body.append('stylePrompt', notebookStylePrompt.trim());
      urls.forEach(url => body.append('urls', url));
      Array.from(notebookAssets || []).forEach(file => body.append('assets', file));

      log(`$ homes-engine notebooklm --url ${urls[0] || '[assets/notebook]'} --style ${notebookStyle} --format brief`);
      log(`projectId: ${projectId}`);
      log('POST /api/engine/notebooklm/video');
      const res = await fetch('/api/engine/notebooklm/video', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Research submit failed (${res.status})`);
      setNotebookStatus({ status: data.status || 'submitted', stage: 'background_queued', progress: 5 });
      log(`notebooklm: background queued`);
      log(`expected wait: ${data.expectedWaitMinutes || '8-12'} minutes`);
      log(`GET /api/research/${projectId}/download`);

      for (let i = 0; i < 90; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        const poll = await pollNotebookLM(projectId);
        setNotebookStatus({ ...poll, progress: poll.status === 'completed' ? 100 : Math.min(95, 5 + i), stage: poll.status === 'completed' ? 'completed' : poll.stage || 'notebooklm_rendering' });
        if (poll.status === 'completed' && poll.videoUrl) {
          const finalUrl = resolveVideoUrl(baseUrl, poll.videoUrl || poll.videoPath || '');
          log('verifying mp4...');
          await verifyPlayableMp4(finalUrl);
          setVideoUrl(finalUrl);
          log(`mp4 verified: ${finalUrl}`);
          log('$ open output.mp4');
          return;
        }
        if (poll.status === 'error' || poll.status === 'failed') throw new Error(poll.error || poll.message || 'Research job failed.');
      }
      throw new Error('Research polling timed out. Long renders may still finish server-side.');
    } catch (error: any) {
      setNotebookStatus(prev => ({ ...prev, status: 'failed', stage: prev.stage || 'failed', error: error.message }));
      log(`error: ${error.message}`);
    } finally {
      setIsNotebookSubmitting(false);
    }
  };

  const runHealthCommand = () => {
    log('$ homes-engine health');
    log(`engine: ${health.engine?.status || (health.error ? 'offline' : 'checking')}`);
    log(`videolm: ${health.demo?.status === 'ok' ? 'connected' : health.error ? 'offline' : 'checking'}`);
    log('notebooklm: ready');
    log(`queue: ${queueConcurrency} render lane`);
  };

  const runGalleryCommand = () => {
    log('$ homes-engine gallery');
    log('$ ls outputs/');
    preRenderedVideos.forEach(video => log(video.url.replace('/videos/', '')));
  };

  const openGalleryVideo = async (videoPath: string) => {
    const finalUrl = resolveVideoUrl(baseUrl, videoPath);
    try {
      setStatus({ status: 'processing', stage: 'verifying_pre_rendered', progress: 95, videoUrl: finalUrl });
      log(`$ open ${videoPath.replace('/videos/', '')}`);
      log('verifying mp4...');
      await verifyPlayableMp4(finalUrl);
      setVideoUrl(finalUrl);
      setStatus({ status: 'completed', stage: 'pre_rendered_verified', progress: 100, videoUrl: finalUrl });
      log(`mp4 verified: ${finalUrl}`);
      log('$ open output.mp4');
    } catch (error: any) {
      setVideoUrl('');
      setStatus({ status: 'failed', stage: 'mp4_validation_failed', progress: 0, videoUrl: finalUrl, error: error.message });
      log(`error: ${error.message}`);
    }
  };

  const bootLines = [
    'HOMES-Engine',
    '',
    '$ python main.py',
    '',
    '[99] HOMES-Engine reviewer mode',
    '',
    '$ homes-engine health',
    `engine: ${health.engine?.status || (health.error ? 'offline' : 'checking')}`,
    `videolm: ${health.demo?.status === 'ok' ? 'connected' : health.error ? 'offline' : 'checking'}`,
    'notebooklm: ready',
    `queue: ${queueConcurrency} render lane`,
    '',
    '$ homes-engine demo',
  ];

  return (
    <section className="min-h-[calc(100vh-2.5rem)] bg-[#050607] px-3 py-4 font-mono text-[13px] leading-relaxed text-slate-100 md:px-5">
      <div className="mx-auto max-w-6xl">
        <div className="border border-emerald-300/20 bg-black shadow-2xl shadow-emerald-950/20">
          <div className="flex items-center gap-2 border-b border-emerald-300/15 px-3 py-2 text-[11px] text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ec3750]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f7c948]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#33d6a6]" />
            <span className="ml-2 text-emerald-200">termux ~/homes-engine</span>
          </div>

          <div className="min-h-[520px] p-4 md:p-5">
            <div className="whitespace-pre-wrap">
              {bootLines.map((line, index) => (
                <div key={`boot-${index}`} className={line.startsWith('$') ? 'text-[#33d6a6]' : line.startsWith('[') ? 'text-[#f7c948]' : 'text-slate-200'}>
                  {line}
                </div>
              ))}
              {logs.map((line, index) => (
                <div key={`log-${index}-${line}`} className={line.startsWith('$') ? 'text-[#33d6a6]' : line.startsWith('error:') ? 'text-[#ec3750]' : line.includes('verified') ? 'text-[#f7c948]' : 'text-slate-300'}>
                  {line}
                </div>
              ))}
              {status.error ? <div className="text-[#ec3750]">error: {status.error}</div> : null}
              {notebookStatus.error ? <div className="text-[#ec3750]">error: {notebookStatus.error}</div> : null}
              <div className="text-[#33d6a6]">$ <span className="inline-block h-4 w-2 translate-y-0.5 bg-[#33d6a6]" /></div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <button onClick={runHealthCommand} className="border border-emerald-300/25 bg-emerald-300/5 px-2.5 py-1.5 text-emerald-200 hover:bg-emerald-300/10">[run] $ homes-engine health</button>
              <button onClick={generateDemo} disabled={isSubmitting} className="border border-emerald-300/25 bg-emerald-300/5 px-2.5 py-1.5 text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-40">[run] $ homes-engine demo</button>
              <button onClick={runGalleryCommand} className="border border-emerald-300/25 bg-emerald-300/5 px-2.5 py-1.5 text-emerald-200 hover:bg-emerald-300/10">[run] $ homes-engine gallery</button>
              <button onClick={submitNotebookVideo} disabled={isNotebookSubmitting} className="border border-amber-300/25 bg-amber-300/5 px-2.5 py-1.5 text-amber-200 hover:bg-amber-300/10 disabled:opacity-40">[run] $ homes-engine notebooklm --url https://hackclub.com --style {notebookStyle} --format brief</button>
            </div>

            <div className="mt-5 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
              <label className="flex items-center gap-2">topic:
                <select value={themeId} onChange={(e) => setThemeId(e.target.value)} className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1 font-mono text-emerald-100 outline-none">
                  {demoThemes.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">style:
                <select value={notebookStyle} onChange={(e) => setNotebookStyle(e.target.value)} className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1 font-mono text-emerald-100 outline-none">
                  {notebookStyles.map(style => <option key={style} value={style}>{style}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 md:col-span-2">url:
                <input value={notebookUrls} onChange={(e) => setNotebookUrls(e.target.value)} className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1 font-mono text-emerald-100 outline-none" />
              </label>
              <label className="flex items-center gap-2">profile:
                <input value={profileId} onChange={(e) => setProfileId(e.target.value)} className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1 font-mono text-emerald-100 outline-none" />
              </label>
              <label className="flex items-center gap-2">notebook:
                <input value={notebookId} onChange={(e) => setNotebookId(e.target.value)} placeholder="optional" className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1 font-mono text-emerald-100 outline-none placeholder:text-slate-600" />
              </label>
              {notebookStyle === 'custom' ? (
                <label className="flex items-center gap-2 md:col-span-2">stylePrompt:
                  <input value={notebookStylePrompt} onChange={(e) => setNotebookStylePrompt(e.target.value)} className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1 font-mono text-emerald-100 outline-none" />
                </label>
              ) : null}
              <label className="flex items-center gap-2">assets:
                <input type="file" multiple onChange={(e) => setNotebookAssets(e.target.files)} className="min-w-0 flex-1 text-slate-500 file:border file:border-white/10 file:bg-black file:px-2 file:py-1 file:font-mono file:text-slate-300" />
              </label>
              <label className="flex items-center gap-2">liveResearch:
                <input type="checkbox" checked={liveResearch} onChange={(e) => setLiveResearch(e.target.checked)} />
              </label>
            </div>

            <div className="mt-6 text-xs text-slate-400">
              <div className="text-[#33d6a6]">$ ls outputs/</div>
              <div className="mt-1 space-y-1">
                {preRenderedVideos.map(video => (
                  <button key={video.url} onClick={() => openGalleryVideo(video.url)} className="block w-full truncate text-left text-slate-300 hover:text-[#f7c948]">
                    {video.url.replace('/videos/', '')}
                  </button>
                ))}
              </div>
            </div>

            {absoluteVideoUrl ? (
              <div className="mt-6 border-t border-emerald-300/15 pt-4">
                <div className="mb-2 text-[#33d6a6]">$ open output.mp4</div>
                <video className="aspect-video w-full bg-black" src={absoluteVideoUrl} controls playsInline preload="metadata" />
                <a href={absoluteVideoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-[#f7c948] hover:text-[#ffe18a]">
                  open mp4
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
