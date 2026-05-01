import React, { useEffect, useMemo, useState } from 'react';
import {
  getBaseUrl,
  getDemoHealth,
  getEngineHealth,
  getManifest,
  pollNotebookLM,
  pollVideoStatus,
  resolveVideoUrl,
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
    detail: 'Paper craft style from the live Hack Club URL',
    url: '/videos/research_community_1777566704645.mp4',
  },
  {
    title: 'Codex Hack Club NotebookLM render',
    detail: 'Cached NotebookLM video, returned immediately by polling',
    url: '/videos/research_codex_notebooklm_hackclub.mp4',
  },
  {
    title: 'Hosted Hack Club demo',
    detail: 'Short hosted render for fast reviewer playback',
    url: '/videos/hosted_demo_hackclub_1777572464094_1777572474992.mp4',
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
  const maxUploadMb = health.manifest?.capabilities?.maxUploadMbPerFile ?? 100;
  const maxImages = health.manifest?.capabilities?.maxImagesPerRender ?? 100;
  const queueConcurrency = health.manifest?.capabilities?.queue?.concurrency ?? 1;

  const log = (message: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 12));

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
      log(`${data.stage || data.status} ${data.progress ?? 0}%`);

      if (data.status === 'completed' && data.videoUrl) {
        setVideoUrl(data.videoUrl);
        log('Completed MP4 is ready.');
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
    setStatus({ status: 'queued', stage: 'client_assets', progress: 0 });
    setVideoUrl('');
    setLogs([]);

    try {
      const projectId = `hosted_demo_${theme.id}_${Date.now()}`;
      log('Creating deterministic browser assets.');
      const audio = makeToneWav(24);
      const images = await Promise.all(Array.from({ length: 6 }, (_, index) => makeDemoImage(theme.label, index, 6)));

      const body = new FormData();
      body.append('projectId', projectId);
      body.append('duration', '24');
      body.append('script', theme.script);
      body.append('audio', audio);
      images.forEach(image => body.append('images', image));

      log('Submitting to hosted VideoLM.');
      const res = await fetch('/api/video/demo/assemble', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Submit failed (${res.status})`);

      setVideoUrl(data.videoUrl);
      setStatus({ status: 'queued', stage: 'queued', progress: 0, videoUrl: data.videoUrl });
      log(`Queued ${data.projectId}.`);
      await pollStatus(data.projectId);
    } catch (error: any) {
      setStatus(prev => ({ ...prev, status: 'failed', stage: 'failed', error: error.message }));
      log(error.message);
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

      log(`Submitting NotebookLM job ${projectId}.`);
      const res = await fetch('/api/engine/notebooklm/video', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `NotebookLM submit failed (${res.status})`);
      setNotebookStatus({ status: data.status || 'submitted', stage: 'background_queued', progress: 5 });
      log(`NotebookLM job accepted in background. Expected wait: ${data.expectedWaitMinutes || '8-12'} minutes.`);

      for (let i = 0; i < 90; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        const poll = await pollNotebookLM(projectId);
        setNotebookStatus({ ...poll, progress: poll.status === 'completed' ? 100 : Math.min(95, 5 + i), stage: poll.status === 'completed' ? 'completed' : poll.stage || 'notebooklm_rendering' });
        if (poll.status === 'completed' && poll.videoUrl) {
          setVideoUrl(poll.videoUrl);
          log(`NotebookLM completed: ${poll.videoUrl}`);
          return;
        }
        if (poll.status === 'error' || poll.status === 'failed') throw new Error(poll.error || poll.message || 'NotebookLM job failed.');
      }
      throw new Error('NotebookLM polling timed out. Long renders may still finish server-side.');
    } catch (error: any) {
      setNotebookStatus(prev => ({ ...prev, status: 'failed', stage: prev.stage || 'failed', error: error.message }));
      log(error.message);
    } finally {
      setIsNotebookSubmitting(false);
    }
  };

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-[#101418]/95 p-4 shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f7c948]">Operational dashboard</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">HOMES Engine Demo</h2>
              <p className="mt-1 font-mono text-xs text-slate-500">VideoLM: {baseUrl}</p>
            </div>
            <span className={`rounded-md border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${
              health.error ? 'border-red-300/30 bg-red-500/10 text-red-200' : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
            }`}>
              Health: {health.error ? 'offline' : 'online'}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Engine</div>
              <div className="mt-1 truncate text-sm font-black text-white">{health.engine?.status || (health.error ? 'offline' : 'checking')}</div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Renderer</div>
              <div className="mt-1 truncate text-sm font-black text-white">{health.demo?.status || (health.error ? 'offline' : 'checking')}</div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Limits</div>
              <div className="mt-1 truncate text-sm font-black text-white">{maxUploadMb}MB / {maxImages} imgs</div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Queue</div>
              <div className="mt-1 truncate text-sm font-black text-white">{queueConcurrency} render lane</div>
            </div>
          </div>
          {health.error ? (
            <div className="mt-3 rounded-md border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{health.error}</div>
          ) : null}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#101418]/95 p-5 shadow-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#33d6a6]">Deterministic render</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white">Generate demo video</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Reviewer-safe path: deterministic assets are generated in the browser, submitted to the hosted VideoLM worker, then returned as a public MP4.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {demoThemes.map(item => (
              <button
                key={item.id}
                onClick={() => setThemeId(item.id)}
                className={`rounded-md border px-3 py-3 text-left transition ${
                  themeId === item.id ? 'border-emerald-300/50 bg-emerald-300/10 text-white' : 'border-white/10 bg-black/25 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="text-sm font-black">{item.label}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.script}</div>
              </button>
            ))}
          </div>

          <button
            onClick={generateDemo}
            disabled={isSubmitting}
            className="mt-5 w-full rounded-lg bg-[#33d6a6] px-4 py-4 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-[#62e4bd] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500"
          >
            {isSubmitting ? 'Generating hosted demo...' : 'Generate demo video'}
          </button>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Status</div>
              <div className="mt-1 text-sm font-black text-white">{status.status || 'idle'}</div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Stage</div>
              <div className="mt-1 truncate text-sm font-black text-white">{status.stage || 'ready'}</div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Progress</div>
              <div className="mt-1 text-sm font-black text-white">{status.progress ?? 0}%</div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Queue</div>
              <div className="mt-1 text-sm font-black text-white">1 lane</div>
            </div>
          </div>

          {status.error ? (
            <div className="mt-4 rounded-md border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {status.error}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Video output</span>
            {absoluteVideoUrl ? <a href={absoluteVideoUrl} className="text-xs font-bold text-emerald-200 hover:text-emerald-100">Open MP4</a> : null}
          </div>
          {absoluteVideoUrl ? (
            <video className="aspect-video w-full rounded-lg border border-white/10 bg-black" src={absoluteVideoUrl} controls />
          ) : (
            <div className="grid aspect-video place-items-center rounded-lg border border-white/10 bg-[#101418] text-sm text-slate-500">
              Generate a short demo or select a pre-rendered video.
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-[#101418]/95 p-4 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#33d6a6]">NotebookLM video</p>
          <div className="mt-3 space-y-3">
            <input
              value={notebookProjectId}
              onChange={(e) => setNotebookProjectId(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50"
              placeholder="projectId"
            />
            <input
              value={notebookTitle}
              onChange={(e) => setNotebookTitle(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50"
              placeholder="Title"
            />
            <input
              value={notebookTheme}
              onChange={(e) => setNotebookTheme(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50"
              placeholder="Theme"
            />
            <textarea
              value={notebookUrls}
              onChange={(e) => setNotebookUrls(e.target.value)}
              className="h-24 w-full resize-none rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-300/50"
              placeholder="https://hackclub.com/"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={notebookStyle}
                onChange={(e) => setNotebookStyle(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50"
              >
                {notebookStyles.map(style => <option key={style} value={style}>{style}</option>)}
              </select>
              <input
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50"
                placeholder="default"
              />
            </div>
            {notebookStyle === 'custom' ? (
              <textarea
                value={notebookStylePrompt}
                onChange={(e) => setNotebookStylePrompt(e.target.value)}
                className="h-20 w-full resize-none rounded-md border border-[#f7c948]/20 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-[#f7c948]/50"
                placeholder="Custom style prompt"
              />
            ) : null}
            <input
              value={notebookId}
              onChange={(e) => setNotebookId(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50"
              placeholder="Existing notebookId (optional)"
            />
            <input
              type="file"
              multiple
              onChange={(e) => setNotebookAssets(e.target.files)}
              className="block w-full text-[10px] text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:text-slate-200"
            />
            <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
              <input type="checkbox" checked={liveResearch} onChange={(e) => setLiveResearch(e.target.checked)} />
              liveResearch
            </label>
            <button
              onClick={submitNotebookVideo}
              disabled={isNotebookSubmitting}
              className="w-full rounded-md bg-[#33d6a6] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#62e4bd] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500"
            >
              {isNotebookSubmitting ? 'NotebookLM rendering...' : 'Submit NotebookLM video'}
            </button>
            <div className="rounded-md border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
              <div>Status: <span className="font-bold text-white">{notebookStatus.status || 'idle'}</span></div>
              <div>Progress: <span className="font-bold text-white">{notebookStatus.progress ?? 0}%</span></div>
              <div>Stage: <span className="font-bold text-white">{notebookStatus.stage || 'ready'}</span></div>
              {notebookStatus.error ? <div className="mt-2 text-red-200">{notebookStatus.error}</div> : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#101418]/95 p-4 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Pre-rendered fallback</p>
          <div className="mt-3 space-y-3">
            {preRenderedVideos.map(video => (
              <button
                key={video.url}
                onClick={() => {
                  setVideoUrl(video.url);
                  setStatus({ status: 'completed', stage: 'pre_rendered', progress: 100, videoUrl: video.url });
                }}
                className="w-full rounded-md border border-white/10 bg-black/25 p-3 text-left transition hover:border-emerald-300/30 hover:bg-emerald-300/[0.06]"
              >
                <div className="text-sm font-black text-white">{video.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">{video.detail}</div>
                <div className="mt-2 truncate font-mono text-[10px] text-emerald-200">{resolveVideoUrl(baseUrl, video.url)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Terminal output</p>
          <div className="mt-3 h-52 overflow-y-auto rounded-md border border-white/10 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
            {logs.length ? logs.map(line => <div key={line}>{line}</div>) : 'Waiting for demo job...'}
          </div>
        </div>
      </aside>
    </section>
  );
};
