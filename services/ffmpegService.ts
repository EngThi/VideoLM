
import { authService } from './authService';
import type { GeneratedImage } from '../types';

class FFmpegService {

  private async fetchWithRetry(url: string, index: number, total: number, prompt: string): Promise<Blob> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // If it's a retry, we ask the backend specifically to try again (it will cycle providers)
            let fetchUrl = url;
            if (attempt > 0) {
                console.log(`🔄 Retry ${attempt} for image ${index + 1} using backend orchestrator...`);
                const retryResp = await fetch('/api/ai/image', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...authService.getAuthHeader()
                    },
                    body: JSON.stringify({ prompt })
                });
                const retryData = await retryResp.json();
                if (retryData.success && retryData.url) fetchUrl = retryData.url;
            }

            const response = await fetch(fetchUrl);
            if (response.ok) {
                const blob = await response.blob();
                if (blob.type.startsWith('image/')) return blob;
            }
            throw new Error(`HTTP ${response.status}`);
        } catch (e) {
            lastError = e as Error;
            console.warn(`Attempt ${attempt + 1} failed for image ${index + 1}: ${lastError.message}`);
            await new Promise(r => setTimeout(r, 2000 * attempt)); // Exponential backoff
        }
    }
    throw lastError || new Error("Failed to fetch image after retries");
  }

  public async assembleVideo(
    audioUrl: string,
    images: GeneratedImage[],
    totalDuration: number,
    script?: string,
    bgMusicUrl?: string,
    projectId: string = 'dev-session'
  ): Promise<string> {
    try {
        console.log(`Starting backend video assembly for project: ${projectId}`);

        const formData = new FormData();
        formData.append('projectId', projectId);

        // 1. Fetch and append Audio
        const audioResp = await fetch(audioUrl);
        const audioBlob = await audioResp.blob();
        formData.append('audio', audioBlob, 'audio.wav');

        // 2. Append total duration and script
        if (totalDuration) {
            formData.append('duration', totalDuration.toString());
        }
        if (script) {
            formData.append('script', script);
        }

        // 3. Fetch and append Background Music (if any)
        if (bgMusicUrl) {
            try {
                const bgmResp = await fetch(bgMusicUrl);
                const bgmBlob = await bgmResp.blob();
                formData.append('bgMusic', bgmBlob, 'bg_music.mp3');
            } catch (e) {
                console.error("Failed to fetch background music, skipping:", e);
            }
        }

        // 4. Fetch and append Images
        console.log(`Preparing ${images.length} images for assembly...`);
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            console.log(`Fetching asset for scene ${i + 1}/${images.length}...`);
            try {
                const imgBlob = await this.fetchWithRetry(img.url, i, images.length, img.prompt || '');
                formData.append('images', imgBlob, `image${i}.png`);
            } catch (e) {
                console.error(`Giving up on image ${i + 1}, using dummy placeholder.`);
                // Create a 1x1 black pixel as emergency fallback to keep FFmpeg happy
                const canvas = document.createElement('canvas');
                canvas.width = 1280; canvas.height = 720;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#111827'; // Dark gray/black
                    ctx.fillRect(0, 0, 1280, 720);
                    ctx.fillStyle = 'white';
                    ctx.font = '30px sans-serif';
                    ctx.fillText(`Scene ${i+1}`, 50, 50);
                }
                const dummyBlob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
                formData.append('images', dummyBlob, `image${i}.png`);
            }
            
            // Critical fix: prevent browser network freeze by not overwhelming with too many parallel requests
            if (i % 3 === 0) await new Promise(r => setTimeout(r, 100));
        }

        // 5. Send to Backend
        console.log("Sending all assets to backend FFmpeg engine...");
        const response = await fetch('/api/video/assemble', {
            method: 'POST',
            headers: {
                ...authService.getAuthHeader()
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error: ${response.status} ${errorText}`);
        }

        // 6. Handle JSON Response (Background Worker Pattern)
        const data = await response.json();
        console.log("Background assembly started:", data);

        // If we have an initial URL, we return it, but the UI should poll for completion
        if (data.videoUrl) {
            // Prepend origin if needed, but since it's same-origin /videos/ works
            return data.videoUrl;
        }

        throw new Error("No video URL returned from backend");

    } catch (error) {
        console.error("Video Assembly Error:", error);
        throw error;
    }
  }

  /**
   * Polls the backend to check if the background video assembly is complete.
   */
  public async pollVideoStatus(projectId: string): Promise<{ status: string; videoUrl?: string; videoPath?: string; error?: string }> {
    try {
        const response = await fetch(`/api/video/${projectId}/status`, {
            headers: {
                ...authService.getAuthHeader()
            }
        });
        if (!response.ok) throw new Error(`Status check failed: ${response.status}`);
        return await response.json();
    } catch (e) {
        console.error("Polling error:", e);
        return { status: 'error', error: (e as Error).message };
    }
  }
}

export const ffmpegService = new FFmpegService();
