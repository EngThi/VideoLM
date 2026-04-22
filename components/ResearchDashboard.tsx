import React, { useState } from 'react';
import { authService } from '../services/authService';

interface ResearchDashboardProps {
  projectId: string;
  onResearchComplete: (videoUrl: string) => void;
}

export const ResearchDashboard: React.FC<ResearchDashboardProps> = ({ projectId, onResearchComplete }) => {
  const [urls, setUrls] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'researching' | 'storyboarding' | 'assembling' | 'completed' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [style, setStyle] = useState<string>('watercolor');

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleStartResearch = async () => {
    if (!urls.trim()) return alert('Insira ao menos uma URL!');
    
    setStatus('researching');
    addLog('🚀 [ENGINE] Gemini 3 Flash Preview activated.');
    addLog('📡 [RESEARCH] Deep Dive cycle starting...');

    try {
      const urlList = urls.split('\n').filter(u => u.trim());
      
      // 1. Injetar Fontes
      addLog(`📡 Ingesting ${urlList.length} sources into Google Studio...`);
      await fetch(`/api/research/${projectId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify({ urls: urlList }),
      });

      // 2. Disparar Trigger
      addLog(`🎙️ Requesting ${style.toUpperCase()} Cinematic Overview...`);
      await fetch(`/api/research/${projectId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify({ type: 'video', style: style }),
      });

      // 3. Polling de Download
      addLog('⏳ Monitoring Google Studio render worker...');
      let isDone = false;
      while (!isDone) {
        await new Promise(r => setTimeout(r, 20000));
        const res = await fetch(`/api/research/${projectId}/download`, {
          headers: authService.getAuthHeader(),
        });
        const data = await res.json();
        
        if (data.status === 'completed') {
          addLog(`✅ 50MB+ HD Artifact downloaded to server: ${data.videoUrl}`);
          setStatus('completed');
          onResearchComplete(data.videoUrl);
          isDone = true;
        } else if (data.status === 'error') {
          throw new Error(data.message);
        } else {
          addLog('📡 Status: Rendering Cinematic Frames...');
        }
      }

    } catch (e: any) {
      addLog(`🚨 FATAL: ${e.message}`);
      setStatus('error');
    }
  };

  return (
    <div className="bg-gray-800/40 rounded-3xl p-6 border border-gray-700/50 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      {/* Decorative Gradient */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="bg-blue-600 p-2 rounded-lg text-lg shadow-lg shadow-blue-900/20">🧠</span>
            RESEARCH <span className="text-blue-400">LAB</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-widest">Autonomous Factual Engine</p>
        </div>
        <div className="flex gap-2">
            {['watercolor', 'anime', 'classic'].map(s => (
                <button 
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${
                        style === s ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-900/40' : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}
                >
                    {s}
                </button>
            ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
            <textarea
                placeholder="https://wikipedia.org/wiki/Artificial_Intelligence..."
                className="w-full h-32 bg-black/40 border border-gray-700/50 rounded-2xl p-4 text-sm font-mono text-blue-100 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all resize-none placeholder:text-gray-700"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                disabled={status !== 'idle' && status !== 'error'}
            />
            <div className="absolute bottom-3 right-4 text-[10px] text-gray-600 font-mono">SOURCES INGESTION MODE</div>
        </div>

        <button
            onClick={handleStartResearch}
            disabled={status !== 'idle' && status !== 'error'}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all transform active:scale-95 ${
            status === 'idle' || status === 'error' 
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-900/20' 
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }`}
        >
            {status === 'idle' ? '🔥 Start Deep Research' : '⚡ System Orchestrating...'}
        </button>

        {log.length > 0 && (
            <div className="mt-6">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Terminal Output</span>
                    <span className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                    </span>
                </div>
                <div className="bg-black/60 backdrop-blur-md rounded-2xl p-5 h-56 overflow-y-auto font-mono text-[11px] leading-relaxed border border-white/5 scrollbar-thin scrollbar-thumb-gray-800">
                {log.map((msg, i) => (
                    <div key={i} className={`mb-1 ${msg.includes('✅') ? 'text-cyan-400' : msg.includes('🚨') ? 'text-red-400' : 'text-gray-400'}`}>
                        <span className="text-gray-600 mr-2">{msg.split('] ')[0]}]</span>
                        {msg.split('] ')[1]}
                    </div>
                ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
