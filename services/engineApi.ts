const FALLBACK_BASE_URL = 'https://54-162-84-165.sslip.io';

export type EngineManifest = {
  name?: string;
  baseUrl?: string;
  publicEndpoints?: Record<string, any>;
  capabilities?: Record<string, any>;
};

export async function getManifest(): Promise<EngineManifest> {
  const res = await fetch('/api/engine/manifest');
  if (!res.ok) throw new Error(`Manifest failed: ${res.status}`);
  return res.json();
}

export async function getEngineHealth() {
  const res = await fetch('/api/engine/health');
  if (!res.ok) throw new Error(`Engine health failed: ${res.status}`);
  return res.json();
}

export async function getDemoHealth() {
  const res = await fetch('/api/video/demo/health');
  if (!res.ok) throw new Error(`Demo health failed: ${res.status}`);
  return res.json();
}

export function getBaseUrl(manifest?: EngineManifest | null) {
  return manifest?.baseUrl || FALLBACK_BASE_URL;
}

export function resolveVideoUrl(baseUrl: string, videoUrl: string) {
  if (!videoUrl) return '';
  return videoUrl.startsWith('http') ? videoUrl : `${baseUrl}${videoUrl}`;
}

export async function pollVideoStatus(projectId: string) {
  const res = await fetch(`/api/video/${encodeURIComponent(projectId)}/status`);
  if (!res.ok) throw new Error(`Status failed: ${res.status}`);
  return res.json();
}

export async function pollNotebookLM(projectId: string) {
  const res = await fetch(`/api/research/${encodeURIComponent(projectId)}/download`);
  if (!res.ok) throw new Error(`NotebookLM poll failed: ${res.status}`);
  return res.json();
}
