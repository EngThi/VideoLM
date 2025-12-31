
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

  // Refs for pipeline consistency (to avoid state batching issues during rapid transitions)
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

  // Handler for standalone Veo 2 Test
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
    setConfig(newConfig);
    setIsLoading(true);
    addLog('🚀 Pipeline initiated. Configuration received.');

    try {
      addLog('🧠 Generating initial content plans with Gemini...');
      setStageStatus(0, 'IN_PROGRESS');
      const ideas = await generateContentIdeas(newConfig.topic);
      setContentIdeas(ideas);
      addLog(`💡 Gemini returned ${ideas.length} content plans. Please choose one to proceed.`);
      setStageStatus(0, 'COMPLETED');
      setCurrentStageIndex(1); // Advance to the next stage
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
                let assetBasePath = '/temp_assets/video_project_assets'; // Default

                // 1. Upload Custom ZIP if provided
                if (config.devAssetsFile) {
                    addLog('📤 Uploading custom asset ZIP...');
                    const formData = new FormData();
                    formData.append('zipFile', config.devAssetsFile);

                    const uploadResp = await fetch('/api/upload-assets', {
                        method: 'POST',
                        body: formData
                    });

                    if (!uploadResp.ok) throw new Error("Failed to upload assets");
                    
                    const uploadResult = await uploadResp.json();
                    assetBasePath = uploadResult.path; // '/temp_assets/custom'
                    
                    // Note: Unzip usually creates a folder if the zip has one. 
                    // We might need to detect subfolders, but for now assuming flat or known structure.
                    // Let's assume the user zips the CONTENTS, not a folder. 
                    // Or we check if 'video_project_assets' exists inside custom.
                    
                    // Simple hack: Try to access script at root, if 404, try inside subfolder
                    const check = await fetch(`${assetBasePath}/script.txt`);
                    if (!check.ok) {
                        assetBasePath = `${assetBasePath}/video_project_assets`;
                    }
                    
                    addLog('✅ Custom assets uploaded and extracted.');
                }

                if (currentStage.id === 'SCRIPT_GENERATION') {
                    addLog('🛠️ DEV MODE: Loading local script...');
                    // Simulate loading script
                    const response = await fetch(`${assetBasePath}/script.txt`);
                    if (!response.ok) throw new Error(`Could not find script.txt in ${assetBasePath}`);
                    const text = await response.text();
                    setScriptResult({ scriptText: text, sources: [] });
                    addLog('✅ Local script loaded.');
                }
                else if (currentStage.id === 'AUDIO_GENERATION') {
                     addLog('🛠️ DEV MODE: Loading local audio...');
                     // Path to the extracted audio in public folder
                     const audioPath = `${assetBasePath}/narration.wav`;
                     setGeneratedAudioUrl(audioPath);
                     generatedAudioUrlRef.current = audioPath;
                     
                     // Get duration roughly or fetch metadata
                     const audio = new Audio(audioPath);
                     await new Promise(r => { audio.onloadedmetadata = r; audio.onerror = r; });
                     const dur = audio.duration || config.duration; // Fallback
                     
                     setGeneratedAudioDuration(dur);
                     generatedAudioDurationRef.current = dur;
                     addLog(`✅ Local audio loaded (${dur.toFixed(1)}s).`);
                }
                else if (currentStage.id === 'VISUAL_GENERATION') {
                     addLog('🛠️ DEV MODE: Loading local storyboard images...');
                     
                     // Dynamic image detection
                     // Since we can't list directory via fetch easily, we try a range or use prompts file
                     // Using the same 1-7 range for now as safe default for the known dataset
                     const imageFiles = [
                        'scene_001.png', 'scene_002.png', 'scene_003.png', 
                        'scene_004.png', 'scene_005.png', 'scene_006.png', 'scene_007.png'
                     ];
                     
                     const newImages: GeneratedImage[] = imageFiles.map((file, i) => ({
                         url: `${assetBasePath}/storyboard/${file}`,
                         prompt: `Local Asset ${i+1}`,
                         index: i
                     }));

                     setGeneratedImages(newImages);
                     generatedImagesRef.current = newImages;
                     addLog(`✅ Loaded ${newImages.length} local images.`);
                }
                else if (currentStage.id === 'VIDEO_ASSEMBLY') {
                    // Normal assembly process, but with local URLs
                    // Note: ffmpegService needs to handle relative paths or full URLs.
                    // Since these are served by Vite, fetching them in ffmpegService (via fetch) works fine.
                    
                    const audioUrl = generatedAudioUrlRef.current;
                    const images = generatedImagesRef.current;
                    const audioDur = generatedAudioDurationRef.current;

                     if (!audioUrl || !images || images.length === 0) {
                        throw new Error("Missing local assets for assembly");
                     }

                    addLog('🎞️ Initializing FFmpeg engine with local assets...');
                    const videoUrl = await ffmpegService.assembleVideo(audioUrl, images, audioDur);

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
                else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Complete stage and continue
                addLog(`✅ Completed stage (DEV): ${currentStage.name}`);
                setStageStatus(currentStageIndex, 'COMPLETED');
                isProcessingRef.current = false;
                if (isMounted.current) setCurrentStageIndex(prev => prev + 1);
                return; 
            }
            // --- END DEV MODE ---

            if (currentStage.id === 'SCRIPT_GENERATION') {
                // Pass duration to ensure script length matches user intent
                const result = await generateScriptWithGoogleSearch(config.topic, selectedIdea.title, selectedIdea.outline, config.duration);
                if (isMounted.current) setScriptResult(result);
                addLog(`📄 Script generated with ${result.sources.length} web sources. Targeted duration: ${config.duration}s`);
            }
            else if (currentStage.id === 'AUDIO_GENERATION') {
                if (!scriptResult) throw new Error("Script not found for audio generation.");
                addLog(`🎙️ Synthesizing audio with Gemini TTS (Voice: ${config.voice})...`);

                const { url, duration } = await generateNarration(scriptResult.scriptText, config.voice);
                
                setGeneratedAudioUrl(url);
                generatedAudioUrlRef.current = url;
                
                setGeneratedAudioDuration(duration);
                generatedAudioDurationRef.current = duration;

                addLog(`🔊 Audio generated (${duration.toFixed(1)}s). Timing established.`);
            }
            else if (currentStage.id === 'VISUAL_GENERATION') {
                if (!scriptResult) throw new Error("Script missing.");
                const audioDur = generatedAudioDurationRef.current;
                if (audioDur === 0) throw new Error("Audio duration missing.");

                addLog(`🎨 Calculating visuals for ${audioDur.toFixed(1)}s of audio (1 image per 10s)...`);

                // 1. Generate Prompts
                const prompts = await generateImagePrompts(scriptResult.scriptText, audioDur);
                addLog(`📝 Generated ${prompts.length} ultra-detailed English image prompts.`);

                // 2. Generate Images from Prompts
                const newImages: GeneratedImage[] = [];
                for (let i = 0; i < prompts.length; i++) {
                    addLog(`🎨 Generating image ${i + 1}/${prompts.length}...`);
                    
                    try {
                        const result = await generateImage(prompts[i]);
                        if (result.success && result.url) {
                            newImages.push({
                                url: result.url,
                                prompt: prompts[i],
                                index: i
                            });
                        } else {
                            addLog(`⚠️ Failed to generate image ${i+1}. Attempting emergency fallback...`);
                            // Emergency fallback: use a simpler prompt and Pollinations directly if possible
                            // Or just retry with a very simple version of the prompt
                            const fallbackResult = await generateImage(`A cinematic high quality illustration of ${config.topic}, photorealistic, 4k`);
                            if (fallbackResult.success && fallbackResult.url) {
                                newImages.push({
                                    url: fallbackResult.url,
                                    prompt: "Fallback: " + prompts[i],
                                    index: i
                                });
                            }
                        }
                    } catch (err) {
                        console.error(`Error generating image ${i}:`, err);
                    }
                }

                setGeneratedImages(newImages);
                generatedImagesRef.current = [...newImages]; // Create a new array to be safe
                addLog(`🎬 Successfully generated ${newImages.length} storyboard images.`);
            }
            else if (currentStage.id === 'VIDEO_ASSEMBLY') {
                const audioUrl = generatedAudioUrlRef.current;
                const images = generatedImagesRef.current;
                const audioDur = generatedAudioDurationRef.current;

                if (!audioUrl || !images || images.length === 0) {
                    addLog(`⚠️ Skipping video assembly: Missing assets. Audio: ${!!audioUrl}, Images: ${images?.length || 0}`);
                    // Ensure we still show what we have
                     setVideoResult({
                         success: true, // partial success
                         generatedImages: images || [],
                         audioUrl: audioUrl,
                         audioDuration: audioDur,
                         script: scriptResult ?? undefined,
                     });
                } else {
                    addLog('🎞️ Initializing FFmpeg engine... This may take a moment.');
                    const videoUrl = await ffmpegService.assembleVideo(audioUrl, images, audioDur);

                    setVideoResult(prev => ({
                        success: true,
                        generatedImages: images,
                        audioUrl: audioUrl,
                        audioDuration: audioDur,
                        videoUrl: videoUrl, // Set the assembled video URL
                        localPath: '/output/final_assets',
                        script: scriptResult ?? undefined,
                    }));

                    addLog('✨ Final video rendered successfully!');
                }
            }
            else {
                // For QC and Upload, we essentially skip/pass-through for now
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            addLog(`✅ Completed stage: ${currentStage.name}`);
            setStageStatus(currentStageIndex, 'COMPLETED');
            isProcessingRef.current = false;

            if (isMounted.current) setCurrentStageIndex(prev => prev + 1);
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : `An unknown error occurred during ${currentStage.name}.`;

            addLog(`❌ Error in stage ${currentStage.name}: ${errorMessage}`);
            setStageStatus(currentStageIndex, 'FAILED');
            isProcessingRef.current = false;
            
            if (isMounted.current) {
                 setIsGenerating(false);
                 // If video assembly fails, we still might have partial results (images/audio)
                 const currentImages = generatedImagesRef.current;
                 const currentAudio = generatedAudioUrlRef.current;
                 
                 if (currentAudio || (currentImages && currentImages.length > 0)) {
                     setVideoResult({
                         success: true, // technically partial success
                         generatedImages: currentImages || [],
                         audioUrl: currentAudio,
                         audioDuration: generatedAudioDurationRef.current,
                         script: scriptResult ?? undefined,
                     });
                 } else {
                    setVideoResult({ success: false });
                 }
            }
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
