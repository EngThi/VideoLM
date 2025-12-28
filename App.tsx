
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ConfigForm } from './components/ConfigForm';
import { StatusDisplay } from './components/StatusDisplay';
import { ResultView } from './components/ResultView';
import { IdeaSelector } from './components/IdeaSelector';
import type { VideoConfig, PipelineStage, VideoResult, ContentIdea, ScriptResult, GeneratedImage } from './types';
import { PIPELINE_STAGES } from './constants';
import { generateContentIdeas, generateScriptWithGoogleSearch, generateNarration, generateVeoVideo, generateImagePrompts, generateImage } from './services/geminiService';
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
    setGeneratedAudioDuration(0);
    setGeneratedImages([]);
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
        if(currentStageIndex >= stages.length) {
            if (isMounted.current) {
                addLog('✅ Pipeline finished!');
                setIsGenerating(false);
            }
            return;
        }

        const currentStage = stages[currentStageIndex];
        if (currentStage.status !== 'PENDING') return;

        setStageStatus(currentStageIndex, 'IN_PROGRESS');
        addLog(`⏳ Starting stage: ${currentStage.name}`);

        try {
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
                setGeneratedAudioDuration(duration);

                addLog(`🔊 Audio generated (${duration.toFixed(1)}s). Timing established.`);
            }
            else if (currentStage.id === 'VISUAL_GENERATION') {
                if (!scriptResult) throw new Error("Script missing.");
                if (generatedAudioDuration === 0) throw new Error("Audio duration missing.");

                addLog(`🎨 Calculating visuals for ${generatedAudioDuration.toFixed(1)}s of audio (1 image per 10s)...`);

                // 1. Generate Prompts
                const prompts = await generateImagePrompts(scriptResult.scriptText, generatedAudioDuration);
                addLog(`📝 Generated ${prompts.length} ultra-detailed English image prompts.`);

                // 2. Generate Images from Prompts
                const newImages: GeneratedImage[] = [];
                for (let i = 0; i < prompts.length; i++) {
                    addLog(`🎨 Generating image ${i + 1}/${prompts.length}...`);
                    const imgUrl = await generateImage(prompts[i]);
                    if (imgUrl) {
                        newImages.push({
                            url: imgUrl,
                            prompt: prompts[i],
                            index: i
                        });
                    }
                }

                setGeneratedImages(newImages);
                addLog(`🎬 Successfully generated ${newImages.length} storyboard images.`);
            }
            else if (currentStage.id === 'VIDEO_ASSEMBLY') {
                if (!generatedAudioUrl || generatedImages.length === 0) {
                    addLog('⚠️ Skipping video assembly: Missing audio or images.');
                } else {
                    addLog('🎞️ Initializing FFmpeg engine... This may take a moment.');
                    const videoUrl = await ffmpegService.assembleVideo(generatedAudioUrl, generatedImages, generatedAudioDuration);

                    setVideoResult(prev => ({
                        success: true,
                        generatedImages: generatedImages,
                        audioUrl: generatedAudioUrl,
                        audioDuration: generatedAudioDuration,
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

            if (isMounted.current) setCurrentStageIndex(prev => prev + 1);
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : `An unknown error occurred during ${currentStage.name}.`;

            addLog(`❌ Error in stage ${currentStage.name}: ${errorMessage}`);
            setStageStatus(currentStageIndex, 'FAILED');
            if (isMounted.current) {
                 setIsGenerating(false);
                 // If video assembly fails, we still might have partial results (images/audio)
                 if (generatedAudioUrl || generatedImages.length > 0) {
                     setVideoResult({
                         success: true, // technically partial success
                         generatedImages: generatedImages,
                         audioUrl: generatedAudioUrl,
                         audioDuration: generatedAudioDuration,
                         script: scriptResult ?? undefined,
                     });
                 } else {
                    setVideoResult({ success: false });
                 }
            }
        }
    };

    runPipeline();

  }, [isGenerating, currentStageIndex, stages, addLog, config, selectedIdea, setStageStatus, scriptResult, generatedAudioUrl, generatedAudioDuration, generatedImages]);

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
