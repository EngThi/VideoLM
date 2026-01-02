
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
    <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
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
    duration: 480,
    style: 'cinematic',
    upload: true,
    seoOptimize: true,
    voice: 'Kore',
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
          <h2 className="text-xl font-semibold text-white border-b border-gray-700 pb-3 mb-6">Pipeline Configuration</h2>
  
          <FormField label="Video Topic">
              <input
              type="text"
              value={config.topic}
              onChange={e => handleChange('topic', e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder={config.useLocalAssets ? "Ignored in Dev Mode" : "e.g., The history of AI"}
              required={!config.useLocalAssets}
              disabled={!!config.useLocalAssets}
              />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Video Quality">
                <select value={config.quality} onChange={e => handleChange('quality', e.target.value)} className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
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
                        className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <div className="flex flex-wrap gap-2">
                        {[1, 5, 7, 10].map((min) => (
                            <button
                                key={min}
                                type="button"
                                onClick={() => handleChange('duration', min * 60)}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                    config.duration === min * 60
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                <select value={config.style} onChange={e => handleChange('style', e.target.value)} className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
                {STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </FormField>
            <FormField label="Voice (Gemini TTS)">
                <select value={config.voice} onChange={e => handleChange('voice', e.target.value)} className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
                {VOICE_PROVIDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </FormField>
        </div>

        <FormField label="Thumbnail Style">
                <select value={config.thumbnailStyle} onChange={e => handleChange('thumbnailStyle', e.target.value)} className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
                {THUMBNAIL_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
        </FormField>

        <div className="flex items-center gap-2 mt-4 p-3 bg-gray-700/30 rounded-lg border border-gray-700">
            <input
                type="checkbox"
                id="useLocalAssets"
                checked={!!config.useLocalAssets}
                onChange={(e) => setConfig({ ...config, useLocalAssets: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="useLocalAssets" className="text-sm font-medium text-gray-300 cursor-pointer">
                🛠️ Dev Mode: Use Local Assets (skip AI generation)
            </label>
        </div>

        {config.useLocalAssets && (
            <div className="pl-4 border-l-2 border-gray-600 ml-2">
                <label className="block text-xs text-gray-400 mb-1">
                    Optional: Upload Custom Project ZIP
                </label>
                <input 
                    type="file" 
                    accept=".zip"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAutoUpload(file);
                    }}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                    Select ZIP to auto-start. Must contain: script.txt, narration.wav, storyboard/*.png
                </p>
            </div>
        )}

        <div className="flex items-center space-x-4 pt-4">
            <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={config.upload} onChange={e => handleChange('upload', e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"/>
            <span className="text-sm text-gray-300">Upload to YouTube</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={config.seoOptimize} onChange={e => handleChange('seoOptimize', e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"/>
            <span className="text-sm text-gray-300">Optimize SEO</span>
            </label>
        </div>

        <button
            type="submit"
            disabled={isGenerating || isTestLoading || isFfmpegTesting || (!config.topic && !config.useLocalAssets)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500/50 flex items-center justify-center space-x-2"
        >
            {isGenerating ? (
                <span className="flex items-center gap-2">Processing Pipeline...</span>
            ) : (
                <span className="flex items-center gap-2">Start Full Pipeline</span>
            )}
        </button>
        </form>

        {/* FFmpeg Manual Test Lab */}
        <div className="border-t-2 border-dashed border-purple-600/50 pt-6 mt-8">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🎞️</span>
                <h3 className="text-lg font-bold text-purple-400">FFmpeg Native Test Lab</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Manually upload files to test backend video assembly.</p>

            <div className="space-y-4">
                 {/* Audio Input */}
                 <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">1. Select Audio (.wav, .mp3)</label>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setFfmpegAudio(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-900/50 file:text-purple-300 hover:file:bg-purple-900/70"
                    />
                </div>

                {/* Images Input */}
                <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">2. Select Images (.png, .jpg)</label>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setFfmpegImages(e.target.files)}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-900/50 file:text-purple-300 hover:file:bg-purple-900/70"
                    />
                    <p className="text-xs text-gray-500 mt-1">Images will be shown for 10s each.</p>
                </div>

                {ffmpegError && (
                    <div className="bg-red-900/20 border border-red-500/50 text-red-200 text-xs p-2 rounded">
                        {ffmpegError}
                    </div>
                )}

                <button
                    onClick={handleFfmpegTest}
                    disabled={isFfmpegTesting || !ffmpegAudio || !ffmpegImages}
                    className="w-full bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
                >
                     {isFfmpegTesting ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Assembling Video...</span>
                        </>
                    ) : (
                        <span>Run FFmpeg Assembly</span>
                    )}
                </button>

                {ffmpegResultUrl && (
                    <div className="mt-4 animate-fade-in bg-black rounded-lg overflow-hidden border border-purple-500/30">
                        <video
                            controls
                            src={ffmpegResultUrl}
                            className="w-full aspect-video"
                        />
                        <div className="p-2 bg-gray-800 text-center">
                            <a href={ffmpegResultUrl} download="ffmpeg_test_output.mp4" className="text-xs text-purple-400 hover:underline">Download Result</a>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Veo 2.0 Test Lab Section */}
        <div className="border-t-2 border-dashed border-gray-600 pt-6 mt-8">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🧪</span>
                <h3 className="text-lg font-bold text-green-400">Veo 2.0 Lab (Test Only)</h3>
            </div>

            <div className="space-y-4">
                <FormField label="Test Prompt">
                    <textarea
                        value={veoPrompt}
                        onChange={(e) => setVeoPrompt(e.target.value)}
                        className="w-full bg-black/30 border border-gray-600 rounded-md p-2 text-sm text-white focus:ring-2 focus:ring-green-500 transition h-20"
                    />
                </FormField>

                <button
                    onClick={handleTestSubmit}
                    disabled={isTestLoading || isGenerating || isFfmpegTesting}
                    className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
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
                    <div className="mt-4 animate-fade-in bg-black rounded-lg overflow-hidden border border-green-500/30">
                        <video
                            controls
                            src={testVideoUrl}
                            className="w-full aspect-video"
                            autoPlay
                        />
                        <div className="p-2 bg-gray-800 text-center">
                            <a href={testVideoUrl} download="veo2-test.mp4" className="text-xs text-green-400 hover:underline">Download Test Video</a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
