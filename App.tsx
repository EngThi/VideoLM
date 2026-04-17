
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ConfigForm } from './components/ConfigForm';
import { StatusDisplay } from './components/StatusDisplay';
import { ResultView } from './components/ResultView';
import { IdeaSelector } from './components/IdeaSelector';
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
                    const audioUrl = generatedAudioUrlRef.current;
                    const images = generatedImagesRef.current;
                    const audioDur = generatedAudioDurationRef.current;
                    const projectId = currentProjectId || `dev_${Date.now()}`;

                     if (!audioUrl || !images || images.length === 0) {
                        addLog("⚠️ Missing local assets for assembly.");
                     } else {
                        addLog(`🎞️ Initializing FFmpeg engine with ${images.length} images...`);
                        await ffmpegService.assembleVideo(audioUrl, images, audioDur, scriptResult?.scriptText, undefined, projectId);
                        
                        addLog('⏳ Background assembly started (Dev Mode). Polling...');
                        let isDone = false;
                        while(!isDone) {
                            await new Promise(r => setTimeout(r, 5000));
                            const res = await ffmpegService.pollVideoStatus(projectId);
                            if (res.status === 'completed' || res.status === 'done') {
                                setVideoResult({
                                    success: true,
                                    generatedImages: images,
                                    audioUrl: audioUrl,
                                    audioDuration: audioDur,
                                    videoUrl: res.videoUrl,
                                    localPath: '/output/final_assets',
                                    script: scriptResult ?? undefined,
                                });
                                isDone = true;
                            } else if (res.status === 'error') throw new Error(res.error);
                        }
                        addLog('✨ Final video rendered successfully!');
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
                const result = await generateScriptWithGoogleSearch(config.topic, selectedIdea.title, selectedIdea.outline, config.duration);
                if (isMounted.current) setScriptResult(result);
                addLog(`📄 Script generated with ${result.sources.length} web sources.`);
            }
            else if (currentStage.id === 'AUDIO_GENERATION') {
                if (!scriptResult) throw new Error("Script not found for audio generation.");
                addLog(`🎙️ Synthesizing audio with Gemini TTS...`);
                const { url, duration } = await generateNarration(scriptResult.scriptText, config.voice);
                setGeneratedAudioUrl(url);
                generatedAudioUrlRef.current = url;
                setGeneratedAudioDuration(duration);
                generatedAudioDurationRef.current = duration;
                addLog(`🔊 Audio generated (${duration.toFixed(1)}s).`);
            }
            else if (currentStage.id === 'VISUAL_GENERATION') {
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
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">YouTubeVideoMaster 🎬</h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-xs md:text-sm text-gray-400 hidden sm:inline">{user.email} (Quota: {user.quota})</span>
            <button onClick={handleLogout} className="bg-red-900/30 hover:bg-red-800 text-red-400 border border-red-800/50 px-3 py-1 rounded-lg text-xs transition-all">Logout</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input 
              type="email" placeholder="Email" 
              className="bg-gray-900 px-3 py-1 rounded-lg text-xs outline-none border border-gray-700 focus:border-blue-500 transition-all"
              value={authEmail} onChange={e => setAuthEmail(e.target.value)}
            />
            <input 
              type="password" placeholder="Pass" 
              className="bg-gray-900 px-3 py-1 rounded-lg text-xs outline-none border border-gray-700 focus:border-blue-500 transition-all"
              value={authPass} onChange={e => setAuthPass(e.target.value)}
            />
            <button 
              disabled={isAuthLoading}
              onClick={handleLogin} className="bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
              Login
            </button>
            <button 
              disabled={isAuthLoading}
              onClick={handleRegister} className="bg-gray-700 hover:bg-gray-600 px-4 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
              Join
            </button>
          </div>
        )}
      </div>

      {!user ? (
        <div className="flex flex-col items-center justify-center flex-grow">
          <div className="text-center p-8 bg-gray-800/30 rounded-3xl border border-gray-700/50 backdrop-blur-sm max-w-lg mx-4">
            <h2 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent italic">FLAVORTOWN EDITION</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              The professional AI video factory is now secured. Sign up to start your production journey with Gemini 2.5 Flash and NotebookLM Research.
            </p>
            <div className="flex justify-center gap-4 text-xs text-gray-500 font-mono">
              <span>JWT PROTECTED</span>
              <span>•</span>
              <span>100MB PAYLOAD READY</span>
            </div>
          </div>
        </div>
      ) : (
        /* Original App Content */
        <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 bg-gray-800/50 rounded-2xl shadow-2xl p-6 h-fit">
            <ConfigForm
              onGenerate={handleGenerate}
              isGenerating={isLoading || isGenerating}
              onTestVeo={handleTestVeo}
              isTestLoading={isTestLoading}
              testVideoUrl={testVideoUrl}
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
      
      <footer className="text-center p-4 text-gray-500 text-sm">
        <p>YouTubeVideoMaster AI Pipeline Interface - Created with Gemini</p>
      </footer>
    </div>
  );
};

export default App;

export default App;
