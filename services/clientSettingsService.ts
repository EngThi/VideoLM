export interface ClientApiSettings {
  geminiApiKey: string;
  openRouterApiKey: string;
  hfTokens: string;
}

const storageKey = 'videolm_client_api_settings';

const emptySettings: ClientApiSettings = {
  geminiApiKey: '',
  openRouterApiKey: '',
  hfTokens: '',
};

class ClientSettingsService {
  getSettings(): ClientApiSettings {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? { ...emptySettings, ...JSON.parse(raw) } : emptySettings;
    } catch {
      return emptySettings;
    }
  }

  saveSettings(settings: ClientApiSettings) {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }

  clearSettings() {
    localStorage.removeItem(storageKey);
  }

  getApiKeyHeaders(): Record<string, string> {
    const settings = this.getSettings();
    const headers: Record<string, string> = {};

    if (settings.geminiApiKey.trim()) headers['x-user-gemini-api-key'] = settings.geminiApiKey.trim();
    if (settings.openRouterApiKey.trim()) headers['x-user-openrouter-api-key'] = settings.openRouterApiKey.trim();
    if (settings.hfTokens.trim()) headers['x-user-hf-tokens'] = settings.hfTokens.trim();

    return headers;
  }

  hasUserKeys(): boolean {
    const settings = this.getSettings();
    return Boolean(settings.geminiApiKey.trim() || settings.openRouterApiKey.trim() || settings.hfTokens.trim());
  }
}

export const clientSettingsService = new ClientSettingsService();
