import React, { useState } from 'react';
import { authService } from '../services/authService';

interface ResearchDashboardProps {
  projectId: string;
  onResearchComplete: (videoUrl: string) => void;
}

const NLM_VIDEO_STYLES = [
  { value: 'auto_select', label: 'Auto' },
  { value: 'classic', label: 'Classic' },
  { value: 'whiteboard', label: 'Whiteboard' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'anime', label: 'Anime' },
  { value: 'kawaii', label: 'Kawaii' },
  { value: 'retro_print', label: 'Retro Print' },
  { value: 'heritage', label: 'Heritage' },
  { value: 'paper_craft', label: 'Paper Craft' },
];

const CUSTOM_STYLE = { value: 'custom', label: 'Custom' };

const researchSteps = [
  {
    title: '1. Choose sources',
    body: 'Paste https:// URLs, pick an existing NotebookLM notebook, or upload documents into a selected notebook.',
  },
  {
    title: '2. Pick a style',
    body: 'The style is sent to NotebookLM video overview generation. Custom opens a prompt field.',
  },
  {
    title: '3. Start render',
    body: 'The server requests the NotebookLM video, polls for completion, downloads the MP4, then applies branding.',
  },
];

export const ResearchDashboard: React.FC<ResearchDashboardProps> = ({ projectId, onResearchComplete }) => {
  const [urls, setUrls] = useState<string>('');
  const [urlError, setUrlError] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'researching' | 'storyboarding' | 'assembling' | 'completed' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [style, setStyle] = useState<string>('watercolor');
  const [customStylePrompt, setCustomStylePrompt] = useState<string>('');
  const [profileId, setProfileId] = useState<string>('default');
  const [cookiesJson, setCookiesJson] = useState<string>('');
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [notebookSources, setNotebookSources] = useState<any[]>([]);
  const [sourceFiles, setSourceFiles] = useState<FileList | null>(null);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  const isBusy = status !== 'idle' && status !== 'error' && status !== 'completed';
  const isCustomStyleMissingPrompt = style === 'custom' && !customStylePrompt.trim();
  const canStart = (status === 'idle' || status === 'error') && !urlError && !isCustomStyleMissingPrompt;

  const parseUrlList = (value: string): string[] => {
    return Array.from(new Set(value.split('\n').map(u => u.trim()).filter(Boolean)));
  };

  const urlCount = parseUrlList(urls).length;
  const selectedNotebook = notebooks.find((notebook: any) => {
    const id = notebook.id || notebook.notebook_id || notebook.notebookId;
    return id === selectedNotebookId;
  });

  const validateHttpsUrls = (value: string): string => {
    const urlList = parseUrlList(value);
    const invalid = urlList.filter((url) => {
      if (!url.startsWith('https://')) return true;
      try {
        return new URL(url).protocol !== 'https:';
      } catch {
        return true;
      }
    });

    if (invalid.length === 0) return '';
    return `Only valid https:// URLs are accepted. Fix: ${invalid.slice(0, 3).join(', ')}`;
  };

  const handleUrlChange = (value: string) => {
    setUrls(value);
    setUrlError(validateHttpsUrls(value));
  };

  const normalizeList = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.notebooks)) return payload.notebooks;
    if (Array.isArray(payload?.sources)) return payload.sources;
    return [];
  };

  const handleCookiesFile = async (file?: File) => {
    if (!file) return;
    setCookiesJson(await file.text());
  };

  const handleSaveProfile = async () => {
    if (!cookiesJson.trim()) return alert('Cole ou envie o cookies.json do NLM.');

    try {
      const res = await fetch('/api/research/nlm/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify({ profileId, cookiesJson }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Profile save failed (${res.status})`);
      addLog(`✅ NLM profile ready: ${data.id}`);
    } catch (e: any) {
      addLog(`🚨 NLM PROFILE: ${e.message}`);
    }
  };

  const handleLoadNotebooks = async () => {
    try {
      const res = await fetch(`/api/research/nlm/notebooks?profileId=${encodeURIComponent(profileId)}`, {
        headers: authService.getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Notebook list failed (${res.status})`);
      const list = normalizeList(data);
      setNotebooks(list);
      addLog(`📚 Loaded ${list.length} NotebookLM notebooks for ${profileId}`);
    } catch (e: any) {
      addLog(`🚨 NLM NOTEBOOKS: ${e.message}`);
    }
  };

  const handleLoadSources = async (notebookId: string) => {
    setSelectedNotebookId(notebookId);
    setNotebookSources([]);
    if (!notebookId) return;

    try {
      const res = await fetch(`/api/research/nlm/notebooks/${encodeURIComponent(notebookId)}/sources?profileId=${encodeURIComponent(profileId)}`, {
        headers: authService.getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Source list failed (${res.status})`);
      const list = normalizeList(data);
      setNotebookSources(list);
      addLog(`📎 Loaded ${list.length} sources from selected notebook`);
    } catch (e: any) {
      addLog(`🚨 NLM SOURCES: ${e.message}`);
    }
  };

  const handleStartResearch = async () => {
    if (!urls.trim() && !selectedNotebookId && !sourceFiles?.length) return alert('Insira uma URL, selecione um notebook ou envie arquivos.');

    const validationError = validateHttpsUrls(urls);
    if (validationError) {
      setUrlError(validationError);
      addLog(`🚨 URL VALIDATION: ${validationError}`);
      return;
    }

    if (style === 'custom' && !customStylePrompt.trim()) {
      addLog('🚨 STYLE VALIDATION: Custom style needs a short style prompt.');
      return;
    }
    
    setStatus('researching');
    addLog('🚀 [ENGINE] Gemini 3 Flash Preview activated.');
    addLog('📡 [RESEARCH] Deep Dive cycle starting...');

    try {
      const urlList = parseUrlList(urls);
      
      // 1. Injetar Fontes
      if (urlList.length > 0) {
        addLog(`📡 Ingesting ${urlList.length} URL sources into Google Studio...`);
        const sourcesRes = await fetch(`/api/research/${projectId}/sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
          body: JSON.stringify({ urls: urlList }),
        });
        if (!sourcesRes.ok) {
          const error = await sourcesRes.json().catch(() => ({}));
          throw new Error(error.message || `Sources request failed (${sourcesRes.status})`);
        }
      }

      if (sourceFiles?.length) {
        if (!selectedNotebookId) throw new Error('Select or load a NotebookLM notebook before uploading files.');
        addLog(`📄 Uploading ${sourceFiles.length} file sources into selected notebook...`);
        const formData = new FormData();
        Array.from(sourceFiles).forEach(file => formData.append('files', file));
        formData.append('notebookId', selectedNotebookId);
        formData.append('profileId', profileId);
        const filesRes = await fetch(`/api/research/${projectId}/source-files`, {
          method: 'POST',
          headers: authService.getAuthHeader(),
          body: formData,
        });
        const filesData = await filesRes.json();
        if (!filesRes.ok) {
          throw new Error(filesData.message || `File upload failed (${filesRes.status})`);
        }
      }

      // 2. Disparar Trigger
      addLog(`🎙️ Requesting ${style.toUpperCase()} Cinematic Overview...`);
      const triggerRes = await fetch(`/api/research/${projectId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify({
          type: 'video',
          style,
          format: 'brief',
          stylePrompt: style === 'custom' ? customStylePrompt.trim() : undefined,
          notebookId: selectedNotebookId || undefined,
          profileId,
        }),
      });
      if (!triggerRes.ok) {
        const error = await triggerRes.json().catch(() => ({}));
        throw new Error(error.message || `Trigger request failed (${triggerRes.status})`);
      }

      // 3. Polling de Download
      addLog('⏳ Google Studio job accepted. Rendering continues in the background; typical wait is 8-12 minutes.');
      let isDone = false;
      const maxPolls = 60;
      for (let pollCount = 1; pollCount <= maxPolls && !isDone; pollCount += 1) {
        await new Promise(r => setTimeout(r, 20000));
        const res = await fetch(`/api/research/${projectId}/download`, {
          headers: authService.getAuthHeader(),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Download polling failed (${res.status})`);
        }
        
        if (data.status === 'completed') {
          addLog(`✅ 50MB+ HD Artifact downloaded to server: ${data.videoUrl}`);
          setStatus('completed');
          onResearchComplete(data.videoUrl);
          isDone = true;
        } else if (data.status === 'error' || data.status === 'failed') {
          throw new Error(data.error || data.message);
        } else {
          addLog(`📡 Status: ${data.stage || data.status || 'google_studio_rendering'} (${pollCount}/${maxPolls})`);
        }
      }

      if (!isDone) {
        throw new Error('NotebookLM is still rendering after 20 minutes. The job may still finish in NotebookLM; try Download again later or use a smaller notebook/source set.');
      }

    } catch (e: any) {
      addLog(`🚨 FATAL: ${e.message}`);
      setStatus('error');
    }
  };

  return (
    <section className="rounded-lg border border-emerald-300/20 bg-[#101418]/95 p-5 shadow-2xl shadow-emerald-950/20">
      <div className="mb-5 border-b border-white/10 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#33d6a6]">Primary workflow</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-black tracking-tight text-white">NotebookLM Video</h3>
            <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
              status === 'completed' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' :
              status === 'error' ? 'border-red-300/30 bg-red-300/10 text-red-200' :
              isBusy ? 'border-yellow-300/30 bg-yellow-300/10 text-yellow-100' :
              'border-white/10 bg-black/25 text-slate-400'
            }`}>
              {status}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Main path for reviewers: generate a NotebookLM video overview from web sources, an existing notebook, or uploaded files. Use only public `https://` URLs.
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-white/10 bg-black/20 p-2">
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Video style</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {NLM_VIDEO_STYLES.map(({ value, label }) => (
                  <button
                      key={value}
                      onClick={() => setStyle(value)}
                      className={`min-h-8 w-full rounded-md border px-2 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.04em] transition ${
                          style === value ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-white/10 bg-black/25 text-slate-400 hover:border-white/25 hover:text-white'
                      }`}
                  >
                      {label}
                  </button>
              ))}
              <button
                  onClick={() => setStyle(CUSTOM_STYLE.value)}
                  className={`min-h-8 w-full rounded-md border px-2 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.04em] transition ${
                      style === CUSTOM_STYLE.value
                      ? 'border-[#f7c948]/70 bg-[#f7c948]/15 text-[#ffe28a]'
                      : 'border-[#f7c948]/25 bg-[#f7c948]/[0.06] text-[#f7c948] hover:border-[#f7c948]/50 hover:bg-[#f7c948]/10'
                  }`}
              >
                  {CUSTOM_STYLE.label}
              </button>
          </div>
          {style === 'custom' ? (
            <div className="mt-3 rounded-md border border-[#f7c948]/20 bg-[#f7c948]/[0.06] p-2">
              <label className="text-[9px] font-black uppercase tracking-[0.12em] text-[#f7c948]">
                Custom prompt
              </label>
              <textarea
                value={customStylePrompt}
                onChange={(e) => setCustomStylePrompt(e.target.value)}
                placeholder="Example: warm indie zine, hand-drawn diagrams, subtle motion, high contrast captions"
                className="mt-2 h-20 w-full resize-none rounded-md border border-white/10 bg-black/35 p-2 text-[11px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#f7c948]/50"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                Sent to NotebookLM as the custom style prompt.
              </p>
            </div>
          ) : null}
        </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {researchSteps.map((step) => (
            <div key={step.title} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-200">{step.title}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-3 text-xs leading-relaxed text-yellow-100">
          Reviewer path: click <span className="font-bold">Load</span> to list NotebookLM notebooks, choose one, confirm it has sources, select a style, then start the render. New URL sources must be full `https://` links. Custom style requires a prompt.
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.16em]">NotebookLM Account</span>
                    <button onClick={handleSaveProfile} className="rounded-md bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-black hover:bg-slate-200">Save</button>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                    Use `default` for the server profile. To bring your own account, paste or upload `~/.notebooklm-mcp-cli/profiles/default/cookies.json`, then save.
                </p>
                <input
                    className="w-full rounded-md border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-300/50"
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    placeholder="default"
                />
                <textarea
                    className="h-20 w-full resize-none rounded-md border border-white/10 bg-black/35 p-3 font-mono text-[10px] text-slate-200 outline-none placeholder:text-slate-700 focus:border-emerald-300/50"
                    value={cookiesJson}
                    onChange={(e) => setCookiesJson(e.target.value)}
                    placeholder='Paste ~/.notebooklm-mcp-cli/profiles/default/cookies.json'
                />
                <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => handleCookiesFile(e.target.files?.[0])}
                    className="block w-full text-[10px] text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:text-slate-200"
                />
            </div>

            <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.16em]">Existing Notebooks</span>
                    <button onClick={handleLoadNotebooks} className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-200 hover:bg-white/10">Load</button>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                    Select a notebook if the sources are already in NotebookLM. Leave this blank when you want the app to create a new notebook from the URL list.
                </p>
                <select
                    className="w-full rounded-md border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-300/50"
                    value={selectedNotebookId}
                    onChange={(e) => handleLoadSources(e.target.value)}
                >
                    <option value="">Create new notebook for this project</option>
                    {notebooks.map((notebook: any) => {
                        const id = notebook.id || notebook.notebook_id || notebook.notebookId;
                        const title = notebook.title || notebook.name || id;
                        return id ? <option key={id} value={id}>{title}</option> : null;
                    })}
                </select>
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.1em]">
                    <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-slate-500">{notebooks.length} notebooks loaded</span>
                    <span className={`rounded-md border px-2 py-1 ${
                        selectedNotebookId ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-black/25 text-slate-500'
                    }`}>
                        {selectedNotebookId ? 'Notebook selected' : 'New notebook mode'}
                    </span>
                </div>
                {selectedNotebook ? (
                    <div className="truncate rounded-md border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
                        Using: {selectedNotebook.title || selectedNotebook.name || selectedNotebookId}
                    </div>
                ) : null}
                <div className="max-h-20 overflow-y-auto rounded-md border border-white/10 bg-black/35 p-2 text-[10px] text-slate-500">
                    {notebookSources.length === 0 ? 'No sources loaded' : notebookSources.slice(0, 8).map((source: any, index) => (
                        <div key={source.id || index} className="truncate text-slate-400">{source.title || source.name || source.url || source.id || JSON.stringify(source).slice(0, 80)}</div>
                    ))}
                </div>
            </div>
        </div>

        <div className="relative">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">URL Sources</span>
                    <p className="mt-1 text-xs text-slate-500">One full `https://` URL per line. These are added to a new or selected NotebookLM notebook.</p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                    urlError ? 'border-red-300/30 bg-red-500/10 text-red-200' : 'border-white/10 bg-black/25 text-slate-500'
                }`}>
                    {urlCount} URL{urlCount === 1 ? '' : 's'}
                </span>
            </div>
            <textarea
                placeholder="https://hackclub.com/
https://example.com/source"
                className="h-32 w-full resize-none rounded-lg border border-white/10 bg-black/25 p-4 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/5"
                value={urls}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={status !== 'idle' && status !== 'error'}
            />
            <div className="absolute bottom-3 right-4 text-[10px] font-mono uppercase tracking-[0.14em] text-slate-600">URL sources</div>
        </div>
        {urlError ? (
            <div className="rounded-md border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {urlError}
            </div>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.16em]">Document Sources</span>
                <span className="text-[10px] text-slate-600">PDF, TXT, MD, DOCX, slides, sheets</span>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
                File upload requires an existing notebook selection. The app uploads these files to that notebook before requesting the video overview.
            </p>
            <input
                type="file"
                multiple
                accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.csv,.xls,.xlsx,application/pdf,text/plain,text/markdown"
                onChange={(e) => setSourceFiles(e.target.files)}
                className="block w-full text-[10px] text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:text-slate-200"
            />
            {sourceFiles?.length ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Array.from(sourceFiles).slice(0, 4).map((file) => (
                        <div key={file.name} className="truncate rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[11px] text-slate-400">
                            {file.name}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>

        <button
            onClick={handleStartResearch}
            disabled={!canStart}
            className={`w-full rounded-lg py-4 text-sm font-black uppercase tracking-[0.14em] transition active:scale-[0.99] ${
            canStart
            ? 'bg-[#33d6a6] text-black hover:bg-[#62e4bd]'
            : 'bg-white/[0.04] text-slate-500 cursor-not-allowed border border-white/10'
            }`}
        >
            {status === 'idle' || status === 'error' ? 'Start NotebookLM video render' : status === 'completed' ? 'Completed' : 'Rendering in background...'}
        </button>

        <div className="grid grid-cols-1 gap-2 text-[11px] text-slate-500 md:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-black/20 p-2">Expected wait: reviewer mode uses NotebookLM brief format and usually takes about 8-12 minutes.</div>
            <div className="rounded-md border border-white/10 bg-black/20 p-2">Output: final MP4 is downloaded to this server and shown as a public URL.</div>
            <div className="rounded-md border border-white/10 bg-black/20 p-2">Failure mode: invalid URLs stop immediately; long renders stop polling after 20 minutes.</div>
        </div>

        {log.length > 0 && (
            <div className="mt-6">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.16em]">Terminal Output</span>
                    <span className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                    </span>
                </div>
                <div className="h-56 overflow-y-auto rounded-lg border border-white/10 bg-black/50 p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                {log.map((msg, i) => (
                    <div key={i} className={`mb-1 ${msg.includes('✅') ? 'text-emerald-300' : msg.includes('🚨') ? 'text-red-300' : 'text-slate-400'}`}>
                        <span className="text-gray-600 mr-2">{msg.split('] ')[0]}]</span>
                        {msg.split('] ')[1]}
                    </div>
                ))}
                </div>
            </div>
        )}
      </div>
    </section>
  );
};
