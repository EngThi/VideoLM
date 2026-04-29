export interface ContentIdea {
  title: string;
  outline: string;
}

export interface ScriptResult {
  scriptText: string;
  sources: Array<string | { title?: string; uri?: string; url?: string }>;
}

export interface GeneratedImage {
  url: string;
  prompt?: string;
  index: number;
}

export interface VideoResult {
  success: boolean;
  videoUrl: string;
  audioUrl: string;
  generatedImages: GeneratedImage[];
  audioDuration: number;
  localPath?: string;
  script?: ScriptResult;
}

export interface PipelineStage {
  id: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  description?: string;
}

export interface VideoConfig {
  topic: string;
  quality?: Quality;
  duration: number;
  style?: Style;
  voice: string;
  upload?: boolean;
  seoOptimize?: boolean;
  thumbnailStyle?: ThumbnailStyle;
  bgMusicFile?: File;
  bgMusicUrl?: string;
  useLocalAssets?: boolean;
  localScript?: string;
  localAudioUrl?: string;
  localImages?: GeneratedImage[];
}

export type Quality = '4K' | '1080p_premium' | '1080p_fast';
export type Style = 'cinematic' | 'documentary' | 'vlog' | 'minimalist' | 'anime' | 'watercolor' | 'classic' | 'bento_grid' | 'clay' | 'bricks' | 'professional' | 'whiteboard' | 'kawaii';
export type VoiceProvider = 'puck' | 'kore' | 'fenrir' | 'charon' | 'aoede' | 'zephyr' | 'orus' | 'alnilam' | 'achernar' | 'gacrux';
export type ThumbnailStyle = 'dramatic' | 'clean' | 'vibrant' | 'meme';
