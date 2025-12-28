
import { GoogleGenAI, Type, Modality, PersonGeneration } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import type { ContentIdea, ScriptResult, Source } from '../types';

// Helper to get a fresh client instance with the current key
const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({ apiKey: apiKey });
}

// --- Helper Functions for Audio ---

/**
 * Divides the script into smaller chunks to process in batches.
 * Limits by word count to avoid payload issues.
 */
function textToBlocks(fullText: string, maxWords: number = 600): string[] {
    const words = fullText.split(/\s+/);
    const blocks: string[] = [];
    let currentBlockWords: string[] = [];

    for (const word of words) {
        if (currentBlockWords.length >= maxWords) {
            blocks.push(currentBlockWords.join(' '));
            currentBlockWords = [];
        }
        currentBlockWords.push(word);
    }

    if (currentBlockWords.length > 0) {
        blocks.push(currentBlockWords.join(' '));
    }
    return blocks;
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function createWavHeader(dataLength: number, sampleRate: number = 24000, numChannels: number = 1): Uint8Array {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sampleRate * blockAlign)
    view.setUint32(28, sampleRate * numChannels * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataLength, true);

    return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// --- Main Service Functions ---

export const generateContentIdeas = async (topic: string): Promise<ContentIdea[]> => {
  try {
    const ai = getAiClient();
    const prompt = `You are an expert YouTube video scriptwriter specializing in viral content.
    For the topic "${topic}", generate 3 distinct and catchy, click-worthy video titles and concise 3-point video outlines for each.
    Ensure the outlines are punchy and create intrigue.
    Return the response as a JSON array where each object has a "title" and an "outline" key. The outline should have points separated by newlines.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.9,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "A catchy, click-worthy video title."
                },
                outline: {
                  type: Type.STRING,
                  description: "A concise 3-point video outline, with each point separated by a newline."
                }
              },
              required: ["title", "outline"]
            }
          }
        }
    });

    const jsonString = response.text || "[]";
    const ideas = JSON.parse(jsonString);

    if (!Array.isArray(ideas) || ideas.some(idea => !idea.title || !idea.outline)) {
        throw new Error("Invalid JSON structure received from Gemini.");
    }

    return ideas;

  } catch (error) {
    console.error("Error calling Gemini API for Ideas:", error);
    throw new Error("Failed to generate content ideas. Please check your API Key.");
  }
};

export const generateScriptWithGoogleSearch = async (topic: string, title: string, outline: string, durationSeconds: number): Promise<ScriptResult> => {
    try {
        const ai = getAiClient();

        // Average speaking rate is ~150 words per minute.
        const wordsPerMinute = 145;
        const targetWordCount = Math.ceil((durationSeconds / 60) * wordsPerMinute);
        const durationMinutes = Math.floor(durationSeconds / 60);
        const durationRemSeconds = durationSeconds % 60;
        const timeString = `${durationMinutes} minutes and ${durationRemSeconds} seconds`;

        const isShortForm = durationSeconds <= 120;

        let depthInstruction = "Provide a standard overview.";
        if (isShortForm) {
            depthInstruction = "Provide a concise, fast-paced summary suitable for a short video. Get straight to the point immediately.";
        } else if (durationSeconds > 300) {
            depthInstruction = "Provide an in-depth, comprehensive analysis. Dive deep into history, nuances, and complex details. This is a long-form video.";
        }

        const prompt = `You are a professional YouTube scriptwriter. Your task is to write a detailed, engaging, and informative script for a video on the topic "${topic}".

        Video Title: "${title}"
        Target Video Duration: ${timeString}
        Target Word Count: Approximately ${targetWordCount} words.
        Research Depth: ${depthInstruction}

        The script should follow this outline:
        ${outline}

        Use Google Search to find the most accurate, up-to-date, and interesting information available. Flesh out each point in the outline with facts, examples, and a compelling narrative.

        CRITICAL INSTRUCTIONS ON DURATION:
        - The user has explicitly requested a video length of ${timeString}.
        ${isShortForm
            ? `- STRICTLY LIMIT your response. The script word count MUST NOT exceed ${targetWordCount + 30} words. Be extremely concise. Do not waffle. Stop when you reach the limit.`
            : `- You MUST write enough content to fill this time. Expand on every point. If the content is too short, add more historical context or facts.`
        }
        - The script should be written in a conversational tone, suitable for a YouTube video.
        - Do not include scene directions or camera instructions, only the narration text.`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              tools: [{googleSearch: {}}],
            },
        });

        const scriptText = response.text || "";
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

        const sources: Source[] = groundingChunks
            .map(chunk => chunk.web)
            .filter((web): web is { uri: string; title: string; } => !!web && !!web.uri && !!web.title);

        return { scriptText, sources };

    } catch (error) {
        console.error("Error calling Gemini API for Script:", error);
        throw new Error("Failed to generate script. Please check your API connection.");
    }
};

export const generateThumbnail = async (title: string, outline: string): Promise<string | null> => {
    const prompt = `Create a high-quality, click-bait style YouTube thumbnail for a video titled "${title}".
    The visuals should be based on this concept: ${outline.replace(/\n/g, ', ')}.
    The image should be 16:9 aspect ratio, vibrant, photorealistic, and eye-catching.`;

    return await generateImage(prompt);
};

/**
 * Generates a list of ultra-detailed image prompts based on the script and audio duration.
 */
export const generateImagePrompts = async (script: string, durationSeconds: number): Promise<string[]> => {
    try {
        const ai = getAiClient();
        const numberOfImages = Math.max(1, Math.ceil(durationSeconds / 10));

        const prompt = `I have a video script and I need to generate image prompts for the visuals.
        The total duration of the audio is ${durationSeconds} seconds.
        I need exactly ${numberOfImages} distinct image prompts (one image for every 10 seconds).

        The Script:
        "${script.substring(0, 8000)}"... (truncated for context)

        Instructions:
        1. Analyze the script to understand the visual progression.
        2. Generate ${numberOfImages} ultra-detailed, high-quality, photorealistic image prompts in ENGLISH.
        3. The prompts must be descriptive (e.g., "Cinematic shot of...", "Close up of...", "A futuristic lab with...").
        4. Return ONLY a JSON array of strings.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const prompts = JSON.parse(response.text || "[]");
        return prompts;
    } catch (error) {
        console.error("Error generating image prompts:", error);
        // Fallback to a single prompt if analysis fails
        return ["A cinematic background relevant to the video topic, 4k, high quality"];
    }
}

/**
 * Generic function to generate an image from a prompt.
 */
export const generateImage = async (prompt: string): Promise<string | null> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9"
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64Data = part.inlineData.data;
                const binaryString = atob(base64Data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: part.inlineData.mimeType || 'image/png' });
                return URL.createObjectURL(blob);
            }
        }
        return null;
    } catch (error) {
        console.error("Error generating image:", error);
        return null;
    }
}

/**
 * Generates a video using Veo 2.0.
 * Allows independent testing of the Veo 2 capability.
 */
export const generateVeoVideo = async (promptText: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const apiKey = process.env.API_KEY;

        console.log("Starting Veo 2.0 generation with prompt:", promptText);

        let operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: promptText,
            config: {
                numberOfVideos: 1,
                aspectRatio: '16:9',
                durationSeconds: 8,
                personGeneration: PersonGeneration.ALLOW_ALL,
            },
        });

        console.log("Operation created:", operation.name);

        while (!operation.done) {
            console.log(`Video ${operation.name} processing... waiting 10s`);
            await new Promise((resolve) => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({
                operation: operation,
            });
        }

        console.log(`Generation done.`);
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!videoUri) {
            throw new Error("No video URI returned from Veo 2.0");
        }

        console.log(`Fetching video from: ${videoUri}`);

        // We must append the key manually when fetching the resource URL
        const response = await fetch(`${videoUri}&key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`Failed to download video bytes: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], { type: 'video/mp4' });
        return URL.createObjectURL(blob);

    } catch (error) {
        console.error("Veo 2.0 Error:", error);
        throw error;
    }
}

export const generateNarration = async (text: string, voiceName: string = 'Kore'): Promise<{url: string, duration: number}> => {
    try {
        const ai = getAiClient();
        // 1. Chunk the text to handle long scripts
        const chunks = textToBlocks(text);
        const audioParts: Uint8Array[] = [];

        console.log(`Generating audio for ${chunks.length} blocks using voice: ${voiceName}`);

        // 2. Generate Audio for each chunk
        for (const chunk of chunks) {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: { parts: [{ text: chunk }] },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceName }
                        }
                    }
                }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                audioParts.push(base64ToUint8Array(base64Audio));
            }
        }

        if (audioParts.length === 0) {
            throw new Error("No audio data received from Gemini.");
        }

        // 3. Merge Audio Buffers
        const totalLength = audioParts.reduce((acc, part) => acc + part.length, 0);
        const mergedAudio = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of audioParts) {
            mergedAudio.set(part, offset);
            offset += part.length;
        }

        // 4. Create WAV file (24kHz 16-bit Mono)
        const header = createWavHeader(mergedAudio.length, 24000, 1);
        const wavData = new Uint8Array(header.length + mergedAudio.length);
        wavData.set(header, 0);
        wavData.set(mergedAudio, header.length);

        const blob = new Blob([wavData], { type: 'audio/wav' });

        // Calculate Duration
        // Sample Rate: 24000, 1 channel, 16-bit (2 bytes) per sample
        // Bytes per second = 24000 * 1 * 2 = 48000
        const durationSeconds = totalLength / 48000;

        return {
            url: URL.createObjectURL(blob),
            duration: durationSeconds
        };

    } catch (error) {
        console.error("Error generating narration:", error);
        throw new Error(`Failed to generate narration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
