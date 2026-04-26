
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ConfigForm } from './components/ConfigForm';
import { StatusDisplay } from './components/StatusDisplay';
import { ResultView } from './components/ResultView';
import { IdeaSelector } from './components/IdeaSelector';
import { ResearchDashboard } from './components/ResearchDashboard';
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

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(authService.getUser());
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

  // Assets state
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | undefined>(undefined);
  const [generatedAudioDuration, setGeneratedAudioDuration] = useState<number>(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  // Refs for pipeline consistency
  const generatedAudioUrlRef = useRef<string | undefined>(undefined);
  const generatedAudioDurationRef = useRef<number>(0);
  const generatedImagesRef = useRef<GeneratedImage[]>([]);
  const isProcessingRef = useRef<boolean>(false);

  // Standalone Test States
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [testVideoUrl, setTestVideoUrl] = useState<string | null>(null);

  const isMounted = useRef(true);
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      {/* Auth Bar */}
      <div className="bg-gray-800/80 backdrop-blur-md p-4 flex justify-between items-center border-b border-gray-700 sticky top-0 z-50">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent tracking-tighter uppercase">VideoLM 🎬</h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-xs md:text-sm text-gray-400 hidden sm:inline">{user.email} (Quota: {user.quota})</span>
            <button onClick={handleLogout} className="bg-red-900/30 hover:bg-red-800 text-red-400 border border-red-800/50 px-3 py-1 rounded-lg text-xs transition-all">Logout</button>
          </div>
        ) : (
          <div className="text-[10px] text-gray-600 font-mono hidden sm:block tracking-[0.2em] uppercase">Protocol: Absolute Cinema • Status: Optimal</div>
        )}
      </div>

      {!user ? (
        <div className="flex flex-col items-center justify-center flex-grow p-4">
          <div className="w-full max-w-md bg-gray-800/40 p-8 rounded-3xl border border-gray-700/50 backdrop-blur-lg shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-5xl font-black mb-2 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent italic tracking-tighter">VideoLM</h2>
              <p className="text-gray-400 text-sm font-mono tracking-widest uppercase">Absolute Cinema Edition</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="group">
                <label className="text-[10px] text-gray-500 font-bold ml-2 mb-1 block uppercase tracking-widest">Authentication Identity</label>
                <input 
                  type="email" placeholder="email@hackclub.app" 
                  className="w-full bg-gray-900/80 px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                  value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                />
              </div>

              <div className="group">
                <label className="text-[10px] text-gray-500 font-bold ml-2 mb-1 block uppercase tracking-widest">Security Access Key</label>
                <input 
                  type="password" placeholder="••••••••" 
                  className="w-full bg-gray-900/80 px-4 py-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                  value={authPass} onChange={e => setAuthPass(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <button 
                  disabled={isAuthLoading}
                  onClick={handleLogin} 
                  className="bg-white text-black hover:bg-gray-200 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50">
                  {isAuthLoading ? '...' : 'Access Engine'}
                </button>
                <button 
                  disabled={isAuthLoading}
                  onClick={handleRegister} 
                  className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50">
                  Deploy Identity
                </button>
              </div>

              <p className="text-[9px] text-center text-gray-600 mt-6 font-mono leading-relaxed">
                BY ACCESSING THIS ENGINE, YOU AGREE TO THE HACK CLUB FLAVORTOWN PROTOCOLS. 
                <br/>STABLE-24.05 • NO LIMITS
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Original App Content */
        <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 h-fit">
              <ConfigForm
                onGenerate={handleGenerate}
                isGenerating={isLoading || isGenerating}
                onTestVeo={handleTestVeo}
                isTestLoading={isTestLoading}
                testVideoUrl={testVideoUrl}
              />
            </div>

            <ResearchDashboard 
              projectId={currentProjectId || `community_${Date.now()}`}
              onResearchComplete={handleResearchComplete}
            />
          </div>
          <div className="lg:col-span-3 flex flex-col gap-8">
            {contentIdeas.length > 0 && !isGenerating ? (
              <IdeaSelector ideas={contentIdeas} onSelect={handleIdeaSelection} />
            ) : (
              <>
                <StatusDisplay stages={stages} logs={logs} scriptResult={scriptResult} />
                {videoResult && <ResultView result={videoResult} onReset={resetState} />}
              </>
            )}
          </div>
        </main>
      )}
      
      <footer className="text-center p-8 text-gray-600 text-xs font-mono tracking-widest uppercase">
        <p>VideoLM: Absolute Cinema Edition • Engineered for Hack Club Flavortown</p>
      </footer>
    </div>
  );
};

export default App;
