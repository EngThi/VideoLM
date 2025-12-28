
import type { GeneratedImage } from '../types';

class FFmpegService {

  public async assembleVideo(
    audioUrl: string,
    images: GeneratedImage[],
    totalDuration: number
  ): Promise<string> {
    try {
        console.log("Starting backend video assembly...");

        const formData = new FormData();

        // 1. Fetch and append Audio
        // audioUrl is likely a blob URL or a remote URL.
        // If it's a blob URL, fetching it gives the blob.
        const audioResp = await fetch(audioUrl);
        const audioBlob = await audioResp.blob();
        formData.append('audio', audioBlob, 'audio.wav');

        // 2. Append total duration (if available)
        // Note: The frontend uses 'totalDuration' which might be the target duration,
        // but typically we want the audio duration for exact sync.
        // We pass it if available.
        if (totalDuration) {
            formData.append('duration', totalDuration.toString());
        }

        // 3. Fetch and append Images
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const imgResp = await fetch(img.url);
            const imgBlob = await imgResp.blob();
            formData.append('images', imgBlob, `image${i}.png`);
        }

        // 4. Send to Backend
        // Use relative path so it works with proxy (dev) and same-origin (production)
        const response = await fetch('/api/assemble', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error: ${response.status} ${errorText}`);
        }

        // 4. Get Result
        const videoBlob = await response.blob();
        return URL.createObjectURL(videoBlob);

    } catch (error) {
        console.error("Video Assembly Error:", error);
        throw new Error("Failed to assemble video. See console for details.");
    }
  }
}

export const ffmpegService = new FFmpegService();
