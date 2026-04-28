
import type { PipelineStage, Quality, Style, VoiceProvider, ThumbnailStyle } from './types';

export const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: '4K', label: '4K Ultra HD (Highest Quality)' },
  { value: '1080p_premium', label: '1080p Premium (High Quality)' },
  { value: '1080p_fast', label: '1080p Fast (Standard Quality)' },
];

export const STYLE_OPTIONS: { value: Style; label: string }[] = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime Style' },
  { value: 'watercolor', label: 'Watercolor Art' },
  { value: 'classic', label: 'Classic Industrial' },
  { value: 'bento_grid', label: 'Bento Grid (Data)' },
  { value: 'clay', label: 'Claymorphism (UI)' },
  { value: 'bricks', label: 'Bricks (Structural)' },
  { value: 'professional', label: 'Professional / Corporate' },
  { value: 'whiteboard', label: 'Whiteboard Animation' },
  { value: 'kawaii', label: 'Kawaii / Cute' },
  { value: 'minimalist', label: 'Minimalist & Clean' },
];

export const VOICE_PROVIDER_OPTIONS: { value: VoiceProvider; label: string }[] = [
  { value: 'puck', label: 'Puck (Male, Assertive)' },
  { value: 'kore', label: 'Kore (Female, Calm)' },
  { value: 'fenrir', label: 'Fenrir (Male, Deep)' },
  { value: 'charon', label: 'Charon (Male, Narrative)' },
  { value: 'aoede', label: 'Aoede (Female, Expressive)' },
  { value: 'zephyr', label: 'Zephyr (Female, Serene)' },
  { value: 'orus', label: 'Orus (Male, Resonant)' },
  { value: 'alnilam', label: 'Alnilam (Male, Engaging)' },
  { value: 'achernar', label: 'Achernar (Male, Storyteller)' },
  { value: 'gacrux', label: 'Gacrux (Female, Bright)' },
];

export const THUMBNAIL_STYLE_OPTIONS: { value: ThumbnailStyle; label: string }[] = [
    { value: 'dramatic', label: 'Dramatic & Bold' },
    { value: 'clean', label: 'Clean & Professional' },
    { value: 'vibrant', label: 'Vibrant & Eye-Catching' },
    { value: 'meme', label: 'Meme-style (Viral)' },
];

export const PIPELINE_STAGES: Omit<PipelineStage, 'status'>[] = [
  {
    id: 'CONTENT_PLANNING',
    name: 'Content Planning & Discovery',
    description: 'Analyzing topic and planning video structure.',
  },
  {
    id: 'SCRIPT_GENERATION',
    name: 'Optimized Script Generation',
    description: 'Writing an engaging script using Google Search for up-to-date information.',
  },
  {
    id: 'AUDIO_GENERATION',
    name: 'Gemini Native Audio Synthesis',
    description: 'Generating professional narration first to determine timing.',
  },
  {
    id: 'VISUAL_GENERATION',
    name: 'AI Storyboard Generation',
    description: 'Generating ultra-detailed images for every 10 seconds of narration.',
  },
  {
    id: 'VIDEO_ASSEMBLY',
    name: 'Asset Preparation',
    description: 'Finalizing video and audio assets for download.',
  },
  {
    id: 'QUALITY_OPTIMIZATION',
    name: 'Quality Control & Optimization',
    description: 'Analyzing final output.',
  },
  {
    id: 'YOUTUBE_UPLOAD',
    name: 'Automated YouTube Upload',
    description: 'Uploading the final video and thumbnail.',
  },
];
