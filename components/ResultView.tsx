
import React, { useState } from 'react';
import type { VideoResult } from '../types';
// @ts-ignore
import JSZip from 'jszip';

interface ResultViewProps {
  result: VideoResult;
  onReset: () => void;
}


// Helper for SRT generation (mirrors backend logic)
const generateSrt = (script: string, totalDuration: number): string => {
    // Better splitting: split by sentence terminators but keep them, and respect newlines
    const rawLines = script.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [];
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
    
    // Calculate total weight (characters)
    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    
    let srtContent = '';
    let currentTime = 0;
    
    lines.forEach((line, i) => {
      // Proportional duration based on character count
      const weight = line.length / totalChars;
      const duration = weight * totalDuration;
      
      const start = currentTime;
      const end = currentTime + duration;
      currentTime = end;
      
      const formatTime = (seconds: number) => {
        const date = new Date(0);
        date.setSeconds(seconds);
        const ms = Math.floor((seconds % 1) * 1000);
        return date.toISOString().substr(11, 8) + ',' + ms.toString().padStart(3, '0');
      };

      srtContent += `${i + 1}\n`;
      srtContent += `${formatTime(start)} --> ${formatTime(end)}\n`;
      srtContent += `${line.trim()}\n\n`;
    });

    return srtContent;
};

export const ResultView: React.FC<ResultViewProps> = ({ result, onReset }) => {
  const [isZipping, setIsZipping] = useState(false);

  const handleDownloadAll = async () => {
    if (isZipping) return;
    setIsZipping(true);

    try {
        const zip = new JSZip();
        const folderName = "video_project_assets";
        const root = zip.folder(folderName);

        // 1. Add Script & Subtitles
        if (result.script) {
            root.file("script.txt", result.script.scriptText);
            root.file("sources.json", JSON.stringify(result.script.sources, null, 2));
            
            // Generate SRT for the ZIP
            if (result.audioDuration) {
                const srtContent = generateSrt(result.script.scriptText, result.audioDuration);
                root.file("subtitles.srt", srtContent);
            }
        }

        // 2. Add Audio
        if (result.audioUrl) {
            const audioBlob = await fetch(result.audioUrl).then(r => r.blob());
            root.file("narration.wav", audioBlob);
        }

        // 3. Add Images
        if (result.generatedImages && result.generatedImages.length > 0) {
            const imgFolder = root.folder("storyboard");
            let promptsText = "";

            // Fetch all images
            await Promise.all(result.generatedImages.map(async (img, idx) => {
                try {
                    const imgBlob = await fetch(img.url).then(r => r.blob());
                    const filename = `scene_${(idx + 1).toString().padStart(3, '0')}.png`;
                    imgFolder.file(filename, imgBlob);
                    promptsText += `Scene ${idx + 1} (${idx*10}s - ${(idx+1)*10}s):\n${img.prompt}\n\n`;
                } catch (err) {
                    console.error(`Failed to zip image ${idx}`, err);
                }
            }));

            // Save prompts text file
            root.file("image_prompts.txt", promptsText);
        } else if (result.imageUrl) {
             const imgBlob = await fetch(result.imageUrl).then(r => r.blob());
             root.file("thumbnail.png", imgBlob);
        }

        // 4. Generate ZIP
        const content = await zip.generateAsync({ type: "blob" });

        // 5. Trigger Download
        const url = window.URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${folderName}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error("Error creating zip:", error);
        alert("Failed to create zip file. Check console for details.");
    } finally {
        setIsZipping(false);
    }
  };

  return (
    <section className="animate-fade-in rounded-lg border border-white/10 bg-[#101418]/95 p-5 shadow-2xl">
      <div className="flex justify-between items-start mb-6">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${result.success ? 'text-emerald-300' : 'text-red-300'}`}>
              {result.success ? 'Artifact ready' : 'Render failed'}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
              {result.success ? 'Production Complete' : 'Production Failed'}
            </h2>
          </div>
          {result.success && (
              <button
                onClick={handleDownloadAll}
                disabled={isZipping}
                className="flex items-center gap-2 rounded-md bg-[#33d6a6] px-4 py-2 text-sm font-black text-black transition hover:bg-[#62e4bd] disabled:bg-slate-700 disabled:text-slate-400"
              >
                 {isZipping ? (
                     <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Creating ZIP...
                     </>
                 ) : (
                     <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Project Pack (ZIP)
                     </>
                 )}
              </button>
          )}
      </div>

      {result.success ? (
        <div className="space-y-8">
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4">
             <p className="text-slate-200">
                 Assets generated and available for review. Audio duration: <span className="font-bold text-white">{result.audioDuration?.toFixed(1)}s</span>.
             </p>
          </div>

          {/* Audio Section */}
          {result.audioUrl && (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.14em]">Narrator Audio</h3>
                    <a
                        href={result.audioUrl}
                        download="gemini_narrator_audio.wav"
                        className="text-xs text-emerald-300 hover:text-emerald-200 flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download WAV
                    </a>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                    <audio controls src={result.audioUrl} className="w-full h-10" />
                </div>
            </div>
          )}

          {/* Storyboard Section */}
          {result.generatedImages && result.generatedImages.length > 0 && (
            <div className="space-y-4">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.14em]">Generated Storyboard ({result.generatedImages.length} Scenes)</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.generatedImages.map((img, idx) => (
                        <div key={idx} className="group relative overflow-hidden rounded-lg border border-white/10 bg-black">
                            <img src={img.url} alt={`Scene ${idx + 1}`} className="w-full aspect-video object-cover" />
                            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">
                                {idx * 10}s - {(idx + 1) * 10}s
                            </div>
                            <div className="p-3">
                                <p className="text-xs text-slate-400 line-clamp-3 hover:line-clamp-none transition-all cursor-help" title={img.prompt}>
                                    <span className="text-emerald-300 font-bold">Prompt:</span> {img.prompt}
                                </p>
                                <a
                                    href={img.url}
                                    download={`scene_${idx + 1}.png`}
                                    className="mt-2 block w-full rounded-md bg-white/10 py-1 text-center text-xs text-white transition hover:bg-white/15"
                                >
                                    Download Image
                                </a>
                            </div>
                        </div>
                    ))}
               </div>
            </div>
          )}

          {/* Single Image Fallback */}
          {result.imageUrl && !result.generatedImages && (
            <div className="space-y-2">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.14em]">Generated Thumbnail</h3>
              <img src={result.imageUrl} alt="Generated Thumbnail" className="w-full rounded-lg shadow-lg aspect-video bg-black border border-white/10 object-cover" />
            </div>
          )}

          {/* Video Section (Fallback if Veo used elsewhere) */}
          {result.videoUrl && (
            <div className="space-y-2">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.14em]">Generated Video</h3>
              <video controls src={result.videoUrl} className="w-full rounded-lg shadow-lg aspect-video bg-black border border-white/10">
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          <button
            onClick={onReset}
            className="w-full mt-8 rounded-md border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-white transition duration-200 hover:bg-white/10"
          >
            Start New Project
          </button>
        </div>
      ) : (
        <div className="text-red-400">
          <p>An error occurred during the generation process. Please check the logs for more details and try again.</p>
           <button
            onClick={onReset}
            className="w-full mt-4 rounded-md bg-red-600 px-4 py-2 font-bold text-white transition duration-200 hover:bg-red-500"
          >
            Try Again
          </button>
        </div>
      )}
    </section>
  );
};
