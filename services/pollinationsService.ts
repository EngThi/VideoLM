export interface PollinationsResponse {
  success: boolean
  data?: any
  error?: string
  timestamp: string
  api: string
  duration?: number
}

export async function generateImagePollinations(
  prompt: string,
  options?: { model?: string; width?: number; height?: number }
): Promise<PollinationsResponse> {
  const startTime = Date.now()
  try {
    const { width = 1024, height = 1024 } = options || {}
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&enhance=true`

    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) throw new Error('Invalid image')

    const objectUrl = URL.createObjectURL(blob)
    const duration = Date.now() - startTime

    return {
      success: true,
      data: { url: objectUrl, size: blob.size },
      timestamp: new Date().toISOString(),
      api: 'Pollinations Image',
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
      api: 'Pollinations Image',
      duration,
    }
  }
}

export async function generateTextPollinations(prompt: string): Promise<PollinationsResponse> {
  const startTime = Date.now()
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const text = await response.text()
    const duration = Date.now() - startTime

    return {
      success: true,
      data: { text, length: text.length },
      timestamp: new Date().toISOString(),
      api: 'Pollinations Text',
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
      api: 'Pollinations Text',
      duration,
    }
  }
}

export async function generateAudioPollinations(
  text: string,
  voice: string = 'alloy'
): Promise<PollinationsResponse> {
  const startTime = Date.now()
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai-audio&voice=${voice}`
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const blob = await response.blob()
    if (!blob.type.startsWith('audio/')) throw new Error('Invalid audio')

    const objectUrl = URL.createObjectURL(blob)
    const duration = Date.now() - startTime

    return {
      success: true,
      data: { url: objectUrl, voice, size: blob.size },
      timestamp: new Date().toISOString(),
      api: 'Pollinations Audio',
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
      api: 'Pollinations Audio',
      duration,
    }
  }
}
