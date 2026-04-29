
import React, { useState } from 'react';
import JSZip from 'jszip';
import type { VideoConfig, GeneratedImage } from '../types';
import { QUALITY_OPTIONS, STYLE_OPTIONS, VOICE_PROVIDER_OPTIONS, THUMBNAIL_STYLE_OPTIONS } from '../constants';
import { ffmpegService } from '../services/ffmpegService';

interface ConfigFormProps {
  onGenerate: (config: VideoConfig) => void;
  isGenerating: boolean;
  onTestVeo: (prompt: string) => void;
  isTestLoading: boolean;
  testVideoUrl: string | null;
}

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</label>
    {children}
  </div>
);

export const ConfigForm: React.FC<ConfigFormProps> = ({
    onGenerate,
    isGenerating,
    onTestVeo,
    isTestLoading,
    testVideoUrl
}) => {
  const [config, setConfig] = useState<VideoConfig>({
    topic: 'mistérios brasileiros',
    quality: '4K',
    duration: 60,
    style: 'cinematic',
    upload: true,
    seoOptimize: true,
    voice: 'kore',
    thumbnailStyle: 'dramatic',
  });

  // Veo Test State
  const [veoPrompt, setVeoPrompt] = useState('A futuristic city with flying cars, cinematic lighting, 4k');

  // FFmpeg Test State
  const [ffmpegAudio, setFfmpegAudio] = useState<File | null>(null);
  const [ffmpegImages, setFfmpegImages] = useState<FileList | null>(null);
  const [isFfmpegTesting, setIsFfmpegTesting] = useState(false);
  const [ffmpegResultUrl, setFfmpegResultUrl] = useState<string | null>(null);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);

  const handleChange = (field: keyof VideoConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(config);
  };

  const handleTestSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    onTestVeo(veoPrompt);
  };

  // FFmpeg Test Handler
  const handleFfmpegTest = async () => {
    if (!ffmpegAudio || !ffmpegImages || ffmpegImages.length === 0) {
        setFfmpegError("Please select one audio file and at least one image.");
        return;
    }

    setIsFfmpegTesting(true);
    setFfmpegResultUrl(null);
    setFfmpegError(null);

    try {
        // 1. Prepare Audio
        const audioUrl = URL.createObjectURL(ffmpegAudio);

        // Get Duration
        const audioEl = new Audio(audioUrl);
        await new Promise((resolve) => {
            audioEl.onloadedmetadata = () => resolve(true);
            audioEl.onerror = () => resolve(true); // proceed even if metadata fails
        });
        const duration = audioEl.duration || 10; // fallback

        // 2. Prepare Images
        const generatedImages: GeneratedImage[] = Array.from(ffmpegImages).map((file, index) => ({
            url: URL.createObjectURL(file as Blob),
            prompt: `Test Image ${index + 1}`,
            index: index
        }));

        // 3. Assemble
        console.log("Testing FFmpeg with:", { audioUrl, images: generatedImages.length, duration });
        const videoUrl = await ffmpegService.assembleVideo(audioUrl, generatedImages, duration);

        setFfmpegResultUrl(videoUrl);

    } catch (err) {
        console.error(err);
        setFfmpegError(err instanceof Error ? err.message : "FFmpeg Test Failed");
    } finally {
        setIsFfmpegTesting(false);
    }
  };

      const handleAutoUpload = async (file: File) => {
          try {
              const zip = await JSZip.loadAsync(file);
              const extractedAssets: Partial<VideoConfig> = {
                  localImages: []
              };
              
              const files = Object.keys(zip.files);
              const images: GeneratedImage[] = [];
              
              for (const filename of files) {
                  const entry = zip.files[filename];
                  if (entry.dir) continue;
                  if (filename.startsWith('__MACOSX')) continue; // Ignore Mac metadata
                  
                  const lowerName = filename.toLowerCase();
                  
                  if (lowerName.endsWith('script.txt') || (!extractedAssets.localScript && lowerName.endsWith('.txt'))) {
                      extractedAssets.localScript = await entry.async('string');
                  } else if (lowerName.endsWith('.wav') || lowerName.endsWith('.mp3')) {
                      // Prefer narration.wav or just take the first audio
                      if (!extractedAssets.localAudioUrl || lowerName.includes('narration')) {
                          const blob = await entry.async('blob');
                          extractedAssets.localAudioUrl = URL.createObjectURL(blob);
                      }
                  } else if (lowerName.match(/\.(jpg|jpeg|png|webp)$/)) {
                      const blob = await entry.async('blob');
                      images.push({
                          url: URL.createObjectURL(blob),
                          prompt: filename, // Use filename as label
                          index: 0
                      });
                  }
              }
              
              // Sort images by filename
              images.sort((a, b) => a.prompt.localeCompare(b.prompt));
              images.forEach((img, idx) => img.index = idx);
              extractedAssets.localImages = images;

              const newConfig = { 
                  ...config, 
                  ...extractedAssets,
                  devAssetsFile: file, 
                  topic: file.name.replace('.zip', ''),
                  useLocalAssets: true 
              };
              
              setConfig(newConfig);
              // Auto-start pipeline
              onGenerate(newConfig);

          } catch (error) {
              console.error("Failed to unzip assets:", error);
              alert("Failed to read ZIP file. See console for details.");
          }
      };
  
      return (
      <div className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-400 sm:grid-cols-3">
            <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Input</span>
                Topic or ZIP assets
            </div>
            <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Output</span>
                MP4 + project pack
            </div>
            <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Mode</span>
                AI or local assembly
            </div>
          </div>
  
          <FormField label="Video Topic">
              <input
              type="text"
              value={config.topic}
              onChange={e => handleChange('topic', e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white transition placeholder:text-slate-700 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
              placeholder={config.useLocalAssets ? "Ignored in Dev Mode" : "e.g., The history of AI"}
              required={!config.useLocalAssets}
              disabled={!!config.useLocalAssets}
              />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Video Quality">
                <select value={config.quality} onChange={e => handleChange('quality', e.target.value)} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10">
                {QUALITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </FormField>
            <FormField label={`Duration: ${Math.floor(config.duration / 60)}m ${config.duration % 60}s`}>
                <div className="space-y-2">
                    <input
                        type="number"
                        min="10"
                        value={config.duration}
                        onChange={e => handleChange('duration', parseInt(e.target.value, 10) || 0)}
                        className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
                    />
                    <div className="flex flex-wrap gap-2">
                        {[1, 5, 7, 10].map((min) => (
                            <button
                                key={min}
                                type="button"
                                onClick={() => handleChange('duration', min * 60)}
                                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                                    config.duration === min * 60
                                        ? 'bg-[#33d6a6] text-black'
                                        : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                }`}
                            >
                                {min} min
                            </button>
                        ))}
                    </div>
                </div>
            </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Visual Style">
                <select value={config.style} onChange={e => handleChange('style', e.target.value)} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10">
                {STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </FormField>
            <FormField label="Voice (Gemini TTS)">
                <select value={config.voice} onChange={e => handleChange('voice', e.target.value)} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10">
                {VOICE_PROVIDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </FormField>
        </div>

        <FormField label="Thumbnail Style">
                <select value={config.thumbnailStyle} onChange={e => handleChange('thumbnailStyle', e.target.value)} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10">
                {THUMBNAIL_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
        </FormField>

        <FormField label="Background Music (Optional)">
            <input
                type="file"
                accept="audio/*"
                disabled={!!config.useLocalAssets}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleChange('bgMusicFile', file || null);
                }}
                className="block w-full cursor-pointer text-sm text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-100 hover:file:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            />
        </FormField>

        <div className="mt-4 flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <input
                type="checkbox"
                id="useLocalAssets"
                checked={!!config.useLocalAssets}
                onChange={(e) => setConfig({ ...config, useLocalAssets: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-400 focus:ring-emerald-400"
            />
            <div>
                <label htmlFor="useLocalAssets" className="cursor-pointer text-sm font-bold text-slate-200">
                    Use local assets
                </label>
                <p className="mt-1 text-xs text-slate-500">Skips AI generation and assembles a ZIP with script, narration, and storyboard images.</p>
            </div>
        </div>

        {config.useLocalAssets && (
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">
                    Project ZIP
                </label>
                <input 
                    type="file" 
                    accept=".zip"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAutoUpload(file);
                    }}
                    className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white hover:file:bg-white/15"
                />
                <p className="mt-2 text-[11px] text-slate-500">
                    Expected files: script.txt, narration.wav or .mp3, and storyboard images.
                </p>
            </div>
        )}

        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
            <input type="checkbox" checked={config.upload} onChange={e => handleChange('upload', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-400 focus:ring-emerald-400"/>
            <span className="text-sm text-slate-300">Prepare YouTube upload</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
            <input type="checkbox" checked={config.seoOptimize} onChange={e => handleChange('seoOptimize', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-400 focus:ring-emerald-400"/>
            <span className="text-sm text-slate-300">Generate SEO metadata</span>
            </label>
        </div>

        <button
            type="submit"
            disabled={isGenerating || isTestLoading || isFfmpegTesting || (!config.topic && !config.useLocalAssets)}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-[#33d6a6] px-4 py-3 font-black text-black transition duration-200 hover:bg-[#62e4bd] focus:outline-none focus:ring-4 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
        >
            {isGenerating ? (
                <span className="flex items-center gap-2">Processing...</span>
            ) : (
                <span className="flex items-center gap-2">Start video pipeline</span>
            )}
        </button>
        </form>

        {/* FFmpeg Manual Test Lab */}
        <details className="group mt-8 rounded-lg border border-white/10 bg-black/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span>
                    <span className="block text-sm font-black uppercase tracking-[0.12em] text-[#f7c948]">FFmpeg test</span>
                    <span className="text-xs text-slate-500">Manual audio + image assembly check</span>
                </span>
                <span className="text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                <span className="hidden text-xs font-bold uppercase text-slate-500 group-open:inline">Close</span>
            </summary>

            <div className="space-y-4 border-t border-white/10 p-4">
                 {/* Audio Input */}
                 <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">1. Select Audio (.wav, .mp3)</label>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setFfmpegAudio(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-100 hover:file:bg-white/15"
                    />
                </div>

                {/* Images Input */}
                <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">2. Select Images (.png, .jpg)</label>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setFfmpegImages(e.target.files)}
                        className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-100 hover:file:bg-white/15"
                    />
                    <p className="text-xs text-slate-500 mt-1">Images will be shown for 10s each.</p>
                </div>

                {ffmpegError && (
                    <div className="rounded-md border border-red-500/50 bg-red-900/20 p-2 text-xs text-red-200">
                        {ffmpegError}
                    </div>
                )}

                <button
                    onClick={handleFfmpegTest}
                    disabled={isFfmpegTesting || !ffmpegAudio || !ffmpegImages}
                    className="flex w-full items-center justify-center space-x-2 rounded-md border border-white/10 bg-white/[0.06] px-4 py-2 font-bold text-white transition duration-200 hover:bg-white/10 disabled:bg-slate-700 disabled:text-slate-400"
                >
                     {isFfmpegTesting ? (
                        <span>Assembling...</span>
                    ) : (
                        <span>Run FFmpeg Assembly</span>
                    )}
                </button>

                {ffmpegResultUrl && (
                    <div className="mt-4 animate-fade-in overflow-hidden rounded-lg border border-white/10 bg-black">
                        <video
                            controls
                            src={ffmpegResultUrl}
                            className="w-full aspect-video"
                        />
                        <div className="bg-white/[0.04] p-2 text-center">
                            <a href={ffmpegResultUrl} download="ffmpeg_test_output.mp4" className="text-xs text-emerald-300 hover:underline">Download Result</a>
                        </div>
                    </div>
                )}
            </div>
        </details>

        {/* Veo 2.0 Test Lab Section */}
        <details className="group rounded-lg border border-white/10 bg-black/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span>
                    <span className="block text-sm font-black uppercase tracking-[0.12em] text-[#33d6a6]">Veo test</span>
                    <span className="text-xs text-slate-500">Standalone prompt-to-video check</span>
                </span>
                <span className="text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                <span className="hidden text-xs font-bold uppercase text-slate-500 group-open:inline">Close</span>
            </summary>

            <div className="space-y-4 border-t border-white/10 p-4">
                <FormField label="Test Prompt">
                    <textarea
                        value={veoPrompt}
                        onChange={(e) => setVeoPrompt(e.target.value)}
                        className="h-20 w-full rounded-md border border-white/10 bg-black/30 p-3 text-sm text-white transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
                    />
                </FormField>

                <button
                    onClick={handleTestSubmit}
                    disabled={isTestLoading || isGenerating || isFfmpegTesting}
                    className="flex w-full items-center justify-center space-x-2 rounded-md bg-[#33d6a6] px-4 py-2 font-bold text-black transition duration-200 hover:bg-[#62e4bd] disabled:bg-slate-700 disabled:text-slate-400"
                >
                     {isTestLoading ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Generating Veo 2 Video...</span>
                        </>
                    ) : (
                        <span>Generate Test Video</span>
                    )}
                </button>

                {testVideoUrl && (
                    <div className="mt-4 animate-fade-in overflow-hidden rounded-lg border border-white/10 bg-black">
                        <video
                            controls
                            src={testVideoUrl}
                            className="w-full aspect-video"
                            autoPlay
                        />
                        <div className="bg-white/[0.04] p-2 text-center">
                            <a href={testVideoUrl} download="veo2-test.mp4" className="text-xs text-green-400 hover:underline">Download Test Video</a>
                        </div>
                    </div>
                )}
            </div>
        </details>
    </div>
  );
};
