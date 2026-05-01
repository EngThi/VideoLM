
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConfigForm } from './components/ConfigForm';
import { StatusDisplay } from './components/StatusDisplay';
import { ResultView } from './components/ResultView';
import { IdeaSelector } from './components/IdeaSelector';
import { ResearchDashboard } from './components/ResearchDashboard';
import { SettingsPage } from './components/SettingsPage';
import { EngineDemoPage } from './components/EngineDemoPage';
import type { VideoConfig, PipelineStage, VideoResult, ContentIdea, ScriptResult, GeneratedImage } from './types';
import { PIPELINE_STAGES } from './constants';
import { generateContentIdeas, generateScriptWithGoogleSearch, generateNarration, generateVeoVideo, generateImagePrompts } from './services/geminiService';
import { generateImage } from './services/imageService';
import { ffmpegService } from './services/ffmpegService';

// Helper to detect real audio duration from URL
const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(30); // Fallback
        audio.src = url;
    });
};

import { authService, AuthUser } from './services/authService';

const workspaceNav = [
  { label: 'NotebookLM', value: 'primary video path', accent: 'bg-[#33d6a6]' },
  { label: 'Factory', value: 'fallback pipeline', accent: 'bg-[#64748b]' },
  { label: 'Queue', value: 'single render lane', accent: 'bg-[#f7c948]' },
  { label: 'Deploy', value: 'stable sslip.io HTTPS', accent: 'bg-[#338eda]' },
];

const statCards = [
  { label: 'NotebookLM', value: 'Primary', detail: 'video overview renders' },
  { label: 'Profiles', value: 'Ready', detail: 'default + BYO cookies' },
  { label: 'Worker', value: 'Queued', detail: 'single render lane' },
  { label: 'Public URL', value: 'HTTPS', detail: 'sslip.io fixed host' },
];

const App: React.FC = () => {
  const isEngineDemoRoute = window.location.pathname === '/engine-demo';
  const [user, setUser] = useState<AuthUser | null>(() => authService.getUser());
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleLogin = async () => {
    setIsAuthLoading(true);
    try {
      const data = await authService.login(authEmail, authPass);
      setUser(data.user);
    } catch (e) {
      alert('Login failed. Try registering first.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    setIsAuthLoading(true);
    try {
      const data = await authService.register(authEmail, authPass);
      setUser(data.user);
    } catch (e) {
      alert('Registration failed.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  const [config, setConfig] = useState<VideoConfig | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>(
    PIPELINE_STAGES.map(stage => ({ ...stage, status: 'PENDING' }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<'workspace' | 'settings'>(() => (
    window.location.pathname === '/settings' ? 'settings' : 'workspace'
  ));

  // Assets state
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | undefined>(undefined);
  const [generatedAudioDuration, setGeneratedAudioDuration] = useState<number>(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  // Refs for pipeline consistency
  const generatedAudioUrlRef = useRef<string | undefined>(undefined);
  const generatedAudioDurationRef = useRef<number>(0);
  const generatedImagesRef = useRef<GeneratedImage[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const researchProjectIdRef = useRef(`community_${Date.now()}`);

  // Standalone Test States
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [testVideoUrl, setTestVideoUrl] = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    document.title = isEngineDemoRoute ? 'HOMES-Engine' : 'VideoLM Factory';
  }, [isEngineDemoRoute]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const resetState = useCallback(() => {
    setStages(PIPELINE_STAGES.map(stage => ({ ...stage, status: 'PENDING' })));
    setCurrentStageIndex(0);
    setLogs([]);
    setVideoResult(null);
    setScriptResult(null);
    setIsGenerating(false);
    setContentIdeas([]);
    setConfig(null);
    setSelectedIdea(null);
    setCurrentProjectId(null);
    
    setGeneratedAudioUrl(undefined);
    generatedAudioUrlRef.current = undefined;
    
    setGeneratedAudioDuration(0);
    generatedAudioDurationRef.current = 0;
    
    setGeneratedImages([]);
    generatedImagesRef.current = [];

    setTestVideoUrl(null);
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const setStageStatus = useCallback((index: number, status: PipelineStage['status']) => {
      if (!isMounted.current) return;
      setStages(prev => prev.map((stage, i) =>
          i === index ? { ...stage, status } : stage
      ));
  }, []);

  const handleTestVeo = async (prompt: string) => {
    if (isTestLoading) return;
    setIsTestLoading(true);
    setTestVideoUrl(null);
    addLog(`🧪 Starting Veo 2.0 Standalone Test with prompt: "${prompt}"`);

    try {
        const url = await generateVeoVideo(prompt);
        setTestVideoUrl(url);
        addLog('✅ Veo 2.0 Test Successful! Video ready below.');
    } catch (error) {
        console.error(error);
        addLog(`❌ Veo 2.0 Test Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsTestLoading(false);
    }
  };

  const handleGenerate = async (newConfig: VideoConfig) => {
    if (isLoading || isGenerating) return;

    resetState();
    
    // Handle Background Music URL creation
    let processedConfig = { ...newConfig };
    if (newConfig.bgMusicFile) {
        const bgMusicUrl = URL.createObjectURL(newConfig.bgMusicFile);
        processedConfig.bgMusicUrl = bgMusicUrl;
        addLog(`🎵 Background music loaded: ${newConfig.bgMusicFile.name}`);
    }

    setConfig(processedConfig);
    const projectId = `proj_${Date.now()}`;
    setCurrentProjectId(projectId);
    setIsLoading(true);
    addLog(`🚀 Pipeline initiated (Project: ${projectId}). Configuration received.`);

    if (processedConfig.useLocalAssets) {
        addLog('🛠️ Dev Mode Active: Skipping idea generation.');
        setSelectedIdea({ title: newConfig.topic || "Local Project", outline: "Generated from local assets" });
        setIsGenerating(true);
        setIsLoading(false);
        return;
    }

    try {
      addLog('🧠 Generating initial content plans with Gemini...');
      setStageStatus(0, 'IN_PROGRESS');
      const ideas = await generateContentIdeas(newConfig.topic);
      setContentIdeas(ideas);
      addLog(`💡 Gemini returned ${ideas.length} content plans. Please choose one to proceed.`);
      setStageStatus(0, 'COMPLETED');
      setCurrentStageIndex(1); 
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred with the AI service.';
      addLog(`❌ Error generating content ideas: ${errorMessage}`);
      setStageStatus(0, 'FAILED');
    } finally {
        if (isMounted.current) setIsLoading(false);
    }
  };

  const handleIdeaSelection = (idea: ContentIdea) => {
    addLog(`👍 Plan selected: "${idea.title}"`);
    setSelectedIdea(idea);
    setContentIdeas([]);
    setIsGenerating(true);
  };

  const handleResearchComplete = (videoUrl: string) => {
    setVideoResult({
      success: true,
      videoUrl: videoUrl,
      audioUrl: '', // N/A for research video
      generatedImages: [],
      audioDuration: 0,
    });
  };

  useEffect(() => {
    if (!isGenerating || !config || !selectedIdea) return;

    const runPipeline = async () => {
        if (isProcessingRef.current) return;
        
        if(currentStageIndex >= stages.length) {
            if (isMounted.current) {
                addLog('✅ Pipeline finished!');
                setIsGenerating(false);
            }
            return;
        }

        const currentStage = stages[currentStageIndex];
        if (currentStage.status !== 'PENDING') return;

        isProcessingRef.current = true;
        setStageStatus(currentStageIndex, 'IN_PROGRESS');
        addLog(`⏳ Starting stage: ${currentStage.name}`);

        try {
            // --- DEV MODE: LOCAL ASSETS BYPASS ---
            if (config.useLocalAssets) {
                 if (currentStage.id === 'SCRIPT_GENERATION') {
                    addLog('🛠️ DEV MODE: Loading local script...');
                    if (config.localScript) {
                         setScriptResult({ scriptText: config.localScript, sources: [] });
                         addLog('✅ Local script loaded.');
                    } else {
                        addLog('⚠️ No script found in ZIP. Using dummy script.');
                        setScriptResult({ scriptText: "Local video project", sources: [] });
                    }
                }
                else if (currentStage.id === 'AUDIO_GENERATION') {
                     addLog('🛠️ DEV MODE: Loading local audio...');
                     if (config.localAudioUrl) {
                         const audioPath = config.localAudioUrl;
                         const detectedDur = await getAudioDuration(audioPath);
                         
                         setGeneratedAudioUrl(audioPath);
                         generatedAudioUrlRef.current = audioPath;
                         setGeneratedAudioDuration(detectedDur);
                         generatedAudioDurationRef.current = detectedDur;
                         addLog(`✅ Local audio loaded (${detectedDur.toFixed(1)}s detected).`);
                     } else {
                         addLog('⚠️ No audio found in config. Skipping.');
                     }
                }
                else if (currentStage.id === 'VISUAL_GENERATION') {
                     addLog('🛠️ DEV MODE: Loading local storyboard images...');
                     if (config.localImages && config.localImages.length > 0) {
                         setGeneratedImages(config.localImages);
                         generatedImagesRef.current = [...config.localImages];
                         addLog(`✅ Loaded ${config.localImages.length} local images.`);
                     } else {
                         addLog('⚠️ No images found in config.');
                     }
                }
                else if (currentStage.id === 'VIDEO_ASSEMBLY') {
                    const audioUrl = generatedAudioUrlRef.current || config.localAudioUrl;
                    const images = (generatedImagesRef.current && generatedImagesRef.current.length > 0) 
                        ? generatedImagesRef.current 
                        : (config.localImages || []);
                    
                    const audioDur = generatedAudioDurationRef.current || 30;
                    const projectId = currentProjectId || `dev_${Date.now()}`;

                     if (!audioUrl || !images || images.length === 0) {
                        addLog("⚠️ Missing local assets for assembly.");
                     } else {
                        addLog(`🎞️ Initializing FFmpeg engine with ${images.length} images...`);
                        
                        // Envia para o backend (usando o service que já injeta o Token JWT)
                        await ffmpegService.assembleVideo(audioUrl, images, audioDur, scriptResult?.scriptText, undefined, projectId);
                        
                        addLog('⏳ Background assembly started. Polling status...');
                        let isDone = false;
                        let attempts = 0;
                        while(!isDone && attempts < 100) {
                            await new Promise(r => setTimeout(r, 5000));
                            attempts++;
                            const res = await ffmpegService.pollVideoStatus(projectId);
                            if (res.status === 'completed' || res.status === 'done') {
                                setVideoResult({
                                    success: true,
                                    generatedImages: images,
                                    audioUrl: audioUrl,
                                    audioDuration: audioDur,
                                    videoUrl: res.videoUrl || res.videoPath,
                                    localPath: '/output/final_assets',
                                    script: scriptResult ?? undefined,
                                });
                                isDone = true;
                                addLog('✅ Final video rendered successfully!');
                            } else if (res.status === 'error') throw new Error(res.error);
                        }
                     }
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                addLog(`✅ Completed stage (DEV): ${currentStage.name}`);
                setStageStatus(currentStageIndex, 'COMPLETED');
                isProcessingRef.current = false;
                if (isMounted.current) setCurrentStageIndex(prev => prev + 1);
                return; 
            }
            // --- END DEV MODE ---

            if (currentStage.id === 'SCRIPT_GENERATION') {
                if (config.useLocalAssets && config.localScript) {
                    addLog('🛠️ DEV MODE: Using local script from ZIP.');
                    setScriptResult({ scriptText: config.localScript, sources: [] });
                } else {
                    const result = await generateScriptWithGoogleSearch(config.topic, selectedIdea.title, selectedIdea.outline, config.duration);
                    if (isMounted.current) setScriptResult(result);
                    addLog(`📄 Script generated with ${result.sources.length} web sources.`);
                }
            }
            else if (currentStage.id === 'AUDIO_GENERATION') {
                if (config.useLocalAssets && config.localAudioUrl) {
                    addLog('🛠️ DEV MODE: Using local audio from ZIP.');
                    setGeneratedAudioUrl(config.localAudioUrl);
                    generatedAudioUrlRef.current = config.localAudioUrl;
                    const dur = await getAudioDuration(config.localAudioUrl);
                    setGeneratedAudioDuration(dur);
                    generatedAudioDurationRef.current = dur;
                } else {
                    if (!scriptResult) throw new Error("Script not found for audio generation.");
                    addLog(`🎙️ Synthesizing audio with Gemini TTS...`);
                    const { url, duration } = await generateNarration(scriptResult.scriptText, config.voice);
                    setGeneratedAudioUrl(url);
                    generatedAudioUrlRef.current = url;
                    setGeneratedAudioDuration(duration);
                    generatedAudioDurationRef.current = duration;
                    addLog(`🔊 Audio generated (${duration.toFixed(1)}s).`);
                }
            }
            else if (currentStage.id === 'VISUAL_GENERATION') {
                if (config.useLocalAssets && config.localImages && config.localImages.length > 0) {
                    addLog(`🛠️ DEV MODE: Using ${config.localImages.length} local images from ZIP.`);
                    setGeneratedImages(config.localImages || []);
                    generatedImagesRef.current = [...(config.localImages || [])];
                } else {
                    if (!scriptResult) throw new Error("Script missing.");
                    const audioDur = generatedAudioDurationRef.current;
                    addLog(`🎨 Calculating visuals for ${audioDur.toFixed(1)}s of audio...`);

                    const prompts = await generateImagePrompts(scriptResult.scriptText, audioDur);
                    addLog(`📝 Generated ${prompts.length} image prompts.`);

                    const newImages: GeneratedImage[] = [];
                    const BATCH_SIZE = 2;
                    
                    for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
                        const batchPrompts = prompts.slice(i, i + BATCH_SIZE);
                        const batchStartIdx = i;
                        addLog(`🎨 Generating batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(prompts.length/BATCH_SIZE)}...`);
                        
                        const batchPromises = batchPrompts.map(async (prompt, relativeIdx) => {
                            const originalIdx = batchStartIdx + relativeIdx;
                            let result = await generateImage(prompt);
                            if (!result.success) {
                                await new Promise(r => setTimeout(r, 2000));
                                result = await generateImage(prompt);
                            }
                            return { result, originalIdx, prompt };
                        });

                        const batchResults = await Promise.all(batchPromises);
                        for (const { result, originalIdx, prompt } of batchResults) {
                            if (result.success && result.url) {
                                newImages.push({ url: result.url, prompt: prompt, index: originalIdx });
                            } else {
                                addLog(`⚠️ Fallback for image ${originalIdx + 1}...`);
                                const fallbackResult = await generateImage(`Cinematic background of ${config.topic}`);
                                if (fallbackResult.success && fallbackResult.url) {
                                    newImages.push({ url: fallbackResult.url, prompt: "Fallback: " + prompt, index: originalIdx });
                                }
                            }
                        }
                        if (i + BATCH_SIZE < prompts.length) await new Promise(r => setTimeout(r, 2000));
                    }
                    newImages.sort((a, b) => a.index - b.index);
                    setGeneratedImages(newImages);
                    generatedImagesRef.current = [...newImages];
                    addLog(`🎬 Generated ${newImages.length} images.`);
                }
            }
            else if (currentStage.id === 'VIDEO_ASSEMBLY') {
                const audioUrl = generatedAudioUrlRef.current;
                const images = generatedImagesRef.current;
                const audioDur = generatedAudioDurationRef.current;
                const bgMusicUrl = config.bgMusicUrl;
                const projectId = currentProjectId || `proj_${Date.now()}`;

                if (!audioUrl || !images || images.length === 0) {
                    throw new Error("Missing assets for assembly.");
                } else {
                    addLog(`🎞️ Triggering background FFmpeg assembly...`);
                    await ffmpegService.assembleVideo(audioUrl, images, audioDur, scriptResult?.scriptText, bgMusicUrl, projectId);

                    addLog('⏳ Assembly started. Polling status...');
                    let isDone = false;
                    let attempts = 0;
                    while (!isDone && attempts < 60) {
                        await new Promise(r => setTimeout(r, 10000));
                        attempts++;
                        const res = await ffmpegService.pollVideoStatus(projectId);
                        addLog(`📡 Status Check ${attempts}: ${res.status}`);

                        if (res.status === 'completed' || res.status === 'done') {
                            setVideoResult({
                                success: true,
                                generatedImages: images,
                                audioUrl: audioUrl,
                                audioDuration: audioDur,
                                videoUrl: res.videoPath || res.videoUrl,
                                localPath: '/output/final_assets',
                                script: scriptResult ?? undefined,
                            });
                            isDone = true;
                            addLog('✨ Video rendered successfully!');
                        } else if (res.status === 'error') throw new Error(res.error);
                    }
                    if (!isDone) throw new Error("Assembly timed out.");
                }
            }

            addLog(`✅ Completed stage: ${currentStage.name}`);
            setStageStatus(currentStageIndex, 'COMPLETED');
            isProcessingRef.current = false;
            if (isMounted.current) setCurrentStageIndex(prev => prev + 1);
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : `An unknown error occurred.`;
            addLog(`❌ Error in stage ${currentStage.name}: ${errorMessage}`);
            setStageStatus(currentStageIndex, 'FAILED');
            isProcessingRef.current = false;
            if (isMounted.current) setIsGenerating(false);
        }
    };

    runPipeline();

  }, [isGenerating, currentStageIndex, stages, addLog, config, selectedIdea, setStageStatus, scriptResult, currentProjectId]);

  if (isEngineDemoRoute) {
    return (
      <main className="min-h-screen bg-[#080b0e] px-4 py-5 text-slate-100 font-sans md:px-6">
        <div className="mx-auto max-w-[1800px]">
          <EngineDemoPage />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 font-sans">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080b0e]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-white/15 shadow-lg">
              <span className="bg-[#ec3750]" />
              <span className="bg-[#f7c948]" />
              <span className="bg-[#33d6a6]" />
              <span className="bg-[#338eda]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black uppercase tracking-[0.18em] text-white">VideoLM Factory</h1>
              <p className="truncate text-xs text-slate-400">Research videos, asset packs, and final renders</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200 md:inline-flex">NotebookLM ready</span>
            <span className="hidden rounded-md border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300 sm:inline-flex">Stable HTTPS</span>
            {user ? (
              <>
                <span className="hidden max-w-[260px] truncate text-xs text-slate-400 lg:inline">{user.email} · quota {user.quota}</span>
                <button onClick={handleLogout} className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-500/20">Logout</button>
              </>
            ) : (
              <span className="hidden text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 sm:block">Reviewer access</span>
            )}
          </div>
        </div>
      </header>

      {!user ? (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1800px] items-center justify-center px-4 py-8">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#101418]/95 p-6 shadow-2xl">
            <div className="mb-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Private build</p>
              <h2 className="text-3xl font-black tracking-tight text-white">Sign in</h2>
              <p className="mt-2 text-sm text-slate-400">Create NotebookLM video overviews from URLs, saved profiles, existing notebooks, or uploaded sources.</p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Email
                <input
                  type="email" placeholder="reviewer@example.com"
                  className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
                  value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                />
              </label>

              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Password
                <input
                  type="password" placeholder="Password"
                  className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
                  value={authPass} onChange={e => setAuthPass(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  disabled={isAuthLoading}
                  onClick={handleLogin} 
                  className="rounded-md bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-slate-200 disabled:opacity-50">
                  {isAuthLoading ? '...' : 'Sign in'}
                </button>
                <button 
                  disabled={isAuthLoading}
                  onClick={handleRegister} 
                  className="rounded-md border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/10 disabled:opacity-50">
                  Register
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-5 px-4 py-5 md:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-white/10 bg-[#101418]/90 p-3 shadow-2xl lg:sticky lg:top-[84px]">
            <div className="mb-4 border-b border-white/10 px-2 pb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
              <p className="mt-1 text-sm font-semibold text-white">Reviewer console</p>
            </div>
            <nav className="space-y-1">
              {workspaceNav.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setActivePage('workspace');
                    window.history.replaceState(null, '', '/');
                  }}
                  className={`flex w-full items-center gap-3 rounded-md border px-2 py-2.5 text-left text-sm transition ${
                    activePage === 'workspace'
                      ? 'border-white/10 bg-white/[0.06] text-white'
                      : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-sm ${item.accent}`} />
                  <div className="min-w-0">
                    <div className="font-bold text-white">{item.label}</div>
                    <div className="truncate text-xs text-slate-500">{item.value}</div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => {
                  setActivePage('settings');
                  window.history.replaceState(null, '', '/settings');
                }}
                className={`flex w-full items-center gap-3 rounded-md border px-2 py-2.5 text-left text-sm transition ${
                  activePage === 'settings' ? 'border-[#338eda]/40 bg-[#338eda]/10 text-white' : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-sm bg-[#338eda]" />
                <div className="min-w-0">
                  <div className="font-bold text-white">Settings</div>
                  <div className="truncate text-xs text-slate-500">API keys and defaults</div>
                </div>
              </button>
            </nav>
          </aside>

          {activePage === 'settings' ? (
            <SettingsPage />
          ) : (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
            <div className="space-y-5">
              <ResearchDashboard
                projectId={currentProjectId || researchProjectIdRef.current}
                onResearchComplete={handleResearchComplete}
              />

              <details className="group rounded-lg border border-white/10 bg-[#0f1318]/80 shadow-xl">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Secondary tool</p>
                    <h2 className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-slate-300">Factory fallback</h2>
                  </div>
                  <span className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                  <span className="hidden rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500 group-open:inline">Close</span>
                </summary>
                <div className="border-t border-white/10 p-4">
                  <p className="mb-4 text-xs leading-relaxed text-slate-500">
                    Optional Gemini + FFmpeg path for asset-pack assembly and fallback tests. The main reviewer flow is the NotebookLM panel above.
                  </p>
                  <ConfigForm
                    onGenerate={handleGenerate}
                    isGenerating={isLoading || isGenerating}
                    onTestVeo={handleTestVeo}
                    isTestLoading={isTestLoading}
                    testVideoUrl={testVideoUrl}
                  />
                </div>
              </details>
            </div>

            <div className="space-y-5">
              <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-lg border border-white/10 bg-[#101418]/90 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
                    <p className="mt-2 text-lg font-black text-white">{card.value}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{card.detail}</p>
                  </div>
                ))}
              </section>

              {contentIdeas.length > 0 && !isGenerating ? (
                <IdeaSelector ideas={contentIdeas} onSelect={handleIdeaSelection} />
              ) : (
                <>
                  <StatusDisplay stages={stages} logs={logs} scriptResult={scriptResult} />
                  {videoResult && <ResultView result={videoResult} onReset={resetState} />}
                </>
              )}
            </div>
          </section>
          )}
        </main>
      )}
    </div>
  );
};

export default App;
