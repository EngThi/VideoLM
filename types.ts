
export type Quality = '4K' | '1080p_premium' | '1080p_fast';
export type Style = 'cinematic' | 'documentary' | 'vlog' | 'minimalist';
// Updated to match actual Gemini Voice names including extended list
export type VoiceProvider = 'Puck' | 'Kore' | 'Fenrir' | 'Charon' | 'Aoede' | 'Zephyr' | 'Lore' | 'Orion' | 'Pegasus' | 'Vega';
export type ThumbnailStyle = 'dramatic' | 'clean' | 'vibrant' | 'meme';

export interface VideoConfig {
  topic: string;
  quality: Quality;
  duration: number; // in seconds
  style: Style;
  upload: boolean;
  seoOptimize: boolean;
  voice: VoiceProvider;
  thumbnailStyle: ThumbnailStyle;
  useLocalAssets?: boolean;
  devAssetsFile?: File | null;
}

export type StageStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
}

export interface GeneratedImage {
    url: string;
    prompt: string;
    index: number;
}

export interface VideoResult {
  success: boolean;
  videoUrl?: string; // Kept for compatibility if needed
  imageUrl?: string; // Single thumbnail
  generatedImages?: GeneratedImage[]; // Sequence of images
  audioUrl?: string;
  audioDuration?: number;
  analyticsUrl?: string;
  localPath?: string;
  script?: ScriptResult;
}

export interface ContentIdea {
  title: string;
  outline: string;
}

// Types for Google Search Grounding
export interface Source {
    title: string;
    uri: string;
}

export interface ScriptResult {
    scriptText: string;
    sources: Source[];
}
