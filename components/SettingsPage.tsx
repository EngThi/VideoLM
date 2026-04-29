import React, { useMemo, useState } from 'react';
import { clientSettingsService, ClientApiSettings } from '../services/clientSettingsService';

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, help, multiline }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-24 w-full resize-none rounded-md border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-white outline-none transition placeholder:text-slate-700 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
      />
    ) : (
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-white outline-none transition placeholder:text-slate-700 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
      />
    )}
    <span className="mt-2 block text-xs leading-relaxed text-slate-500">{help}</span>
  </label>
);

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<ClientApiSettings>(() => clientSettingsService.getSettings());
  const [saved, setSaved] = useState(false);

  const activeCount = useMemo(
    () => [settings.geminiApiKey, settings.openRouterApiKey, settings.hfTokens].filter(v => v.trim()).length,
    [settings],
  );

  const update = (field: keyof ClientApiSettings, value: string) => {
    setSaved(false);
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const save = () => {
    clientSettingsService.saveSettings(settings);
    setSaved(true);
  };

  const clear = () => {
    clientSettingsService.clearSettings();
    setSettings({ geminiApiKey: '', openRouterApiKey: '', hfTokens: '' });
    setSaved(false);
  };

  return (
    <section className="rounded-lg border border-white/10 bg-[#101418]/95 p-5 shadow-2xl">
      <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#338eda]">Settings</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">API keys</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Keys saved here stay in this browser and are sent only with AI requests. If a field is empty, the server fallback key is used.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-400">
          {activeCount} user key source{activeCount === 1 ? '' : 's'} configured
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Field
            label="Google Gemini API key"
            value={settings.geminiApiKey}
            onChange={(value) => update('geminiApiKey', value)}
            placeholder="AIza..."
            help="Used for content planning, scripts, image generation, narration, and test video features when available."
          />
          <Field
            label="OpenRouter API key"
            value={settings.openRouterApiKey}
            onChange={(value) => update('openRouterApiKey', value)}
            placeholder="sk-or-..."
            help="Used as an image/provider fallback when configured."
          />
          <Field
            label="Hugging Face tokens"
            value={settings.hfTokens}
            onChange={(value) => update('hfTokens', value)}
            placeholder="hf_... , hf_..."
            help="Comma-separated tokens. The backend tries them as user-provided Hugging Face credentials before server fallback."
            multiline
          />

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <button
              onClick={save}
              className="rounded-md bg-[#33d6a6] px-4 py-3 text-sm font-black text-black transition hover:bg-[#62e4bd]"
            >
              Save browser settings
            </button>
            <button
              onClick={clear}
              className="rounded-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Clear saved keys
            </button>
            {saved && <span className="self-center text-sm text-emerald-300">Saved locally.</span>}
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-white/10 bg-black/25 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">How fallback works</p>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-400">
            <p>User keys are preferred for authenticated browser requests.</p>
            <p>If no user key is saved, VideoLM uses the server keys from `.env`.</p>
            <p>NotebookLM cookies are managed in the LM Engine panel because they are profile/session credentials, not model API keys.</p>
          </div>
        </aside>
      </div>
    </section>
  );
};
