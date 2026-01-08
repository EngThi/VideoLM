
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

const App: React.FC = () => {
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
    setIsLoading(true);
    addLog('🚀 Pipeline initiated. Configuration received.');

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
                 // ... (Dev Mode logic unchanged for brevity, focusing on optimization below)
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
                     if (!audioUrl || !images || images.length === 0) {
                        addLog("⚠️ Missing local assets for assembly.");
                     } else {
                        addLog(`🎞️ Initializing FFmpeg engine with ${images.length} images...`);
                        const videoUrl = await ffmpegService.assembleVideo(audioUrl, images, audioDur, scriptResult?.scriptText);
                        setVideoResult(prev => ({
                            success: true,
                            generatedImages: images,
                            audioUrl: audioUrl,
                            audioDuration: audioDur,
                            videoUrl: videoUrl,
                            localPath: '/output/final_assets',
                            script: scriptResult ?? undefined,
                        }));
                        addLog('✨ Final video rendered successfully (Dev Mode)!');
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

                // --- OPTIMIZATION START: BATCH PROCESSING ---
                const newImages: GeneratedImage[] = [];
                const BATCH_SIZE = 5; // Process 5 images at a time (Aggressive Parallelism)
                
                for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
                    const batchPrompts = prompts.slice(i, i + BATCH_SIZE);
                    const batchStartIdx = i;
                    
                    addLog(`🎨 Generating batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(prompts.length/BATCH_SIZE)} (Images ${i+1}-${Math.min(i+BATCH_SIZE, prompts.length)})...`);
                    
                    // Create promises for the batch
                    const batchPromises = batchPrompts.map((prompt, relativeIdx) => 
                        generateImage(prompt).then(result => ({
                            result,
                            originalIdx: batchStartIdx + relativeIdx,
                            prompt
                        }))
                    );

                    // Wait for all in batch
                    const batchResults = await Promise.all(batchPromises);

                    // Process results
                    for (const { result, originalIdx, prompt } of batchResults) {
                        if (result.success && result.url) {
                            newImages.push({
                                url: result.url,
                                prompt: prompt,
                                index: originalIdx
                            });
                        } else {
                            addLog(`⚠️ Failed to generate image ${originalIdx + 1}. Attempting simple fallback...`);
                            const fallbackResult = await generateImage(`Cinematic illustration of ${config.topic}`);
                            if (fallbackResult.success && fallbackResult.url) {
                                newImages.push({
                                    url: fallbackResult.url,
                                    prompt: "Fallback: " + prompt,
                                    index: originalIdx
                                });
                            }
                        }
                    }
                    
                    // Optional: Small cooldown between batches to be nice to API
                    if (i + BATCH_SIZE < prompts.length) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
                
                // Sort by index to ensure order is correct after async batching
                newImages.sort((a, b) => a.index - b.index);
                // --- OPTIMIZATION END ---

                setGeneratedImages(newImages);
                generatedImagesRef.current = [...newImages];
                addLog(`🎬 Successfully generated ${newImages.length} storyboard images.`);
            }
            else if (currentStage.id === 'VIDEO_ASSEMBLY') {
                const audioUrl = generatedAudioUrlRef.current;
                const images = generatedImagesRef.current;
                const audioDur = generatedAudioDurationRef.current;
                const bgMusicUrl = config.bgMusicUrl;

                if (!audioUrl || !images || images.length === 0) {
                    addLog(`⚠️ Skipping video assembly: Missing assets.`);
                     setVideoResult({
                         success: true, 
                         generatedImages: images || [],
                         audioUrl: audioUrl,
                         audioDuration: audioDur,
                         script: scriptResult ?? undefined,
                     });
                } else {
                    addLog(`🎞️ Initializing FFmpeg engine... ${bgMusicUrl ? '(with BGM)' : ''}`);
                    const videoUrl = await ffmpegService.assembleVideo(
                        audioUrl, 
                        images, 
                        audioDur, 
                        scriptResult?.scriptText,
                        bgMusicUrl
                    );

                    setVideoResult(prev => ({
                        success: true,
                        generatedImages: images,
                        audioUrl: audioUrl,
                        audioDuration: audioDur,
                        videoUrl: videoUrl,
                        localPath: '/output/final_assets',
                        script: scriptResult ?? undefined,
                    }));
                    addLog('✨ Final video rendered successfully!');
                }
            }
            else {
                await new Promise(resolve => setTimeout(resolve, 1000));
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

  }, [isGenerating, currentStageIndex, stages, addLog, config, selectedIdea, setStageStatus, scriptResult]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <Header />
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
      <footer className="text-center p-4 text-gray-500 text-sm">
        <p>YouTubeVideoMaster AI Pipeline Interface - Created with Gemini</p>
      </footer>
    </div>
  );
};

export default App;
