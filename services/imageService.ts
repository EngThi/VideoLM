export interface ImageGenerationResult {
  success: boolean;
  url?: string;
  provider: string;
  timestamp: string;
  error?: string;
}

export interface ImageOptions {
  width?: number;
  height?: number;
}

/**
 * Generates an image by calling the backend API.
 * This avoids CORS issues and keeps API keys secure on the server.
 */
export async function generateImage(prompt: string, options?: ImageOptions): Promise<ImageGenerationResult> {
  try {
    const response = await fetch('/api/ai/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, options }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[IMAGE] ❌ Error calling backend image generation:', error);
    return {
      success: false,
      provider: 'none',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkImageProvidersStatus() {
  // Now managed by backend, returning a simplified status
  return {
    providers: [
      { name: 'Server-side Orchestrator', configured: true },
    ],
    timestamp: new Date().toISOString(),
  };
}
