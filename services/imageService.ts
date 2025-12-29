export interface ImageGenerationResult {
  success: boolean
  url?: string
  provider: string
  timestamp: string
  error?: string
  fallbackUsed?: boolean
  attemptCount?: number
  duration?: number
}

const logger = {
  info: (msg: string) => console.log(`[IMAGE] ℹ️  ${msg}`),
  success: (msg: string) => console.log(`[IMAGE] ✅ ${msg}`),
  error: (msg: string, err: any) => console.error(`[IMAGE] ❌ ${msg}`, err),
  warn: (msg: string) => console.warn(`[IMAGE] ⚠️  ${msg}`),
}

// 1️⃣ GEMINI
async function generateImageGemini(prompt: string): Promise<string | null> {
  logger.info('Attempting: Gemini (gemini-2.5-flash-image)')
  try {
    const apiKey = process.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      logger.warn('Gemini API key not configured')
      return null
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Using the verified model and method for native image generation
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (!response.candidates || response.candidates.length === 0) {
      logger.warn('Gemini returned no candidates');
      return null;
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        // Convert base64 to blob URL
        const binaryString = atob(imageData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        logger.success('Gemini: Image generated successfully');
        return url;
      }
    }
    
    logger.warn('Gemini response did not contain inline image data');
    return null;

  } catch (error: any) {
    // Handle specific Quota Exceeded error gracefully
    if (error?.response?.error?.code === 429 || error?.message?.includes('429')) {
         logger.warn('Gemini Quota Exceeded (429) - Skipping to next provider');
    } else {
         logger.error('Gemini failed', error);
    }
    return null
  }
}

// 2️⃣ POLLINATIONS
async function generateImagePollinations(prompt: string): Promise<string | null> {
  logger.info('Attempting: Pollinations.AI')
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024`
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) throw new Error('Not an image')

    const objectUrl = URL.createObjectURL(blob)
    logger.success('Pollinations: Image generated')
    return objectUrl
  } catch (error) {
    logger.error('Pollinations failed', error)
    return null
  }
}

// 3️⃣ HUGGING FACE
async function generateImageHuggingFace(prompt: string): Promise<string | null> {
  logger.info('Attempting: Hugging Face')
  try {
    const hfToken = process.env.VITE_HF_TOKEN
    if (!hfToken) {
      logger.warn('HF token not configured')
      return null
    }

    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        headers: { Authorization: `Bearer ${hfToken}` },
        method: 'POST',
        body: JSON.stringify({ inputs: prompt }),
      }
    )

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    logger.success('HuggingFace: Image generated')
    return url
  } catch (error) {
    logger.error('HuggingFace failed', error)
    return null
  }
}

// 4️⃣ STABLE DIFFUSION
async function generateImageStableDiffusion(prompt: string): Promise<string | null> {
  logger.info('Attempting: Stable Diffusion API')
  try {
    const sdKey = process.env.VITE_STABLE_DIFFUSION_KEY
    if (!sdKey) {
      logger.warn('SD key not configured')
      return null
    }

    const response = await fetch('https://stablediffusionapi.com/api/v3/text2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: sdKey,
        prompt: prompt,
        width: '1024',
        height: '1024',
        samples: '1',
        num_inference_steps: '30',
      }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    // Stable Diffusion API usually returns "output" array with URLs
    const imageUrl = data.output?.[0] || data.fetch_result

    if (imageUrl) {
      logger.success('Stable Diffusion: Image generated')
      return imageUrl
    }
    return null
  } catch (error) {
    logger.error('Stable Diffusion failed', error)
    return null
  }
}

// 5️⃣ REPLICATE
async function generateImageReplicate(prompt: string): Promise<string | null> {
  logger.info('Attempting: Replicate (Flux)')
  try {
    const replicateToken = process.env.VITE_REPLICATE_TOKEN
    if (!replicateToken) {
      logger.warn('Replicate token not configured')
      return null
    }

    // Note: Calling Replicate directly from browser might fail due to CORS unless using a proxy
    // but we will implement it as requested.
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'fed7ef18aff716a318e917c099277041e2e36dbf5ef6ef0b46505b0f7192bba6', // Flux
        input: { prompt, go_fast: true, guidance: 3.5 },
      }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const prediction = await response.json()
    let status = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Token ${replicateToken}` },
    }).then(r => r.json())

    let attempts = 0;
    while (status.status === 'processing' || status.status === 'starting') {
      if(attempts++ > 30) throw new Error("Timeout");
      await new Promise(resolve => setTimeout(resolve, 1000))
      status = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${replicateToken}` },
      }).then(r => r.json())
    }

    if (status.output?.[0]) {
      logger.success('Replicate: Image generated')
      return status.output[0]
    }
    return null
  } catch (error) {
    logger.error('Replicate failed', error)
    return null
  }
}

// 6️⃣ CRAIYON
async function generateImageCraiyon(prompt: string): Promise<string | null> {
  logger.info('Attempting: Craiyon (DALL-E Mini)')
  try {
    if (process.env.VITE_CRAIYON_ENABLED !== 'true') {
      logger.warn('Craiyon disabled')
      return null
    }

    // Craiyon often has CORS issues in browser and might need a proxy, 
    // but implementing as requested.
    const response = await fetch('https://api.craiyon.com/v3/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    let imageUrl = data.images?.[0]
    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `https://img.craiyon.com/${imageUrl}`;
    }

    if (imageUrl) {
      logger.success('Craiyon: Image generated')
      return imageUrl
    }
    return null
  } catch (error) {
    logger.error('Craiyon failed', error)
    return null
  }
}

// 🎯 ORCHESTRATOR
export async function generateImage(prompt: string): Promise<ImageGenerationResult> {
  const startTime = Date.now()

  logger.info('\n' + '='.repeat(60))
  logger.info(`Starting Image Generation: "${prompt}"`) 
  logger.info('='.repeat(60) + '\n')

  const providers = [
    { name: 'Gemini', fn: generateImageGemini },
    { name: 'HuggingFace', fn: generateImageHuggingFace },
    { name: 'StableDiffusion', fn: generateImageStableDiffusion },
    { name: 'Pollinations', fn: generateImagePollinations },
    { name: 'Replicate', fn: generateImageReplicate },
    { name: 'Craiyon', fn: generateImageCraiyon },
  ]

  let attemptCount = 0

  for (const provider of providers) {
    attemptCount++
    try {
      const url = await provider.fn(prompt)
      if (url) {
        const duration = Date.now() - startTime
        return {
          success: true,
          url,
          provider: provider.name,
          timestamp: new Date().toISOString(),
          fallbackUsed: attemptCount > 1,
          attemptCount,
          duration,
        }
      }
    } catch (error) {
      logger.error(`${provider.name} error`, error)
    }
  }

  const duration = Date.now() - startTime
  return {
    success: false,
    provider: 'none',
    timestamp: new Date().toISOString(),
    error: 'All providers failed',
    fallbackUsed: false,
    attemptCount,
    duration,
  }
}

export async function checkImageProvidersStatus() {
  return {
    providers: [
      { name: 'Gemini', configured: !!process.env.VITE_GEMINI_API_KEY },
      { name: 'Pollinations', configured: true }, // Free/Public
      { name: 'HuggingFace', configured: !!process.env.VITE_HF_TOKEN },
      { name: 'StableDiffusion', configured: !!process.env.VITE_STABLE_DIFFUSION_KEY },
      { name: 'Replicate', configured: !!process.env.VITE_REPLICATE_TOKEN },
      { name: 'Craiyon', configured: process.env.VITE_CRAIYON_ENABLED === 'true' },
    ],
    timestamp: new Date().toISOString(),
  }
}
