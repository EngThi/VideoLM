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

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleStartResearch = async () => {
    if (!urls.trim()) return alert('Insira ao menos uma URL!');
    
    setStatus('researching');
    addLog('🚀 Iniciando Ciclo de Pesquisa Profunda...');

    try {
      const urlList = urls.split('\n').filter(u => u.trim());
      
      // 1. Injetar Fontes
      addLog(`📡 Alimentando IA com ${urlList.length} fontes...`);
      await fetch(`/api/research/${projectId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify({ urls: urlList }),
      });

      // 2. Disparar Trigger
      addLog('🎙️ Disparando motor NotebookLM (Deep Dive)...');
      await fetch(`/api/research/${projectId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify({ type: 'video', style: 'watercolor' }),
      });

      // 3. Polling de Download
      addLog('⏳ Monitorando progresso no Google Studio (isso pode levar alguns minutos)...');
      let isDone = false;
      while (!isDone) {
        await new Promise(r => setTimeout(r, 20000));
        const res = await fetch(`/api/research/${projectId}/download`, {
          headers: authService.getAuthHeader(),
        });
        const data = await res.json();
        
        if (data.status === 'completed') {
          addLog(`✅ Vídeo Cinematográfico baixado: ${data.videoUrl}`);
          setStatus('completed');
          onResearchComplete(data.videoUrl);
          isDone = true;
        } else if (data.status === 'error') {
          throw new Error(data.message);
        } else {
          addLog('📡 Google ainda processando...');
        }
      }

    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`);
      setStatus('error');
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-sm">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="text-blue-400">🧠</span> Modo Research (Deep Dive)
      </h3>
      
      <p className="text-sm text-gray-400 mb-4">
        Cole links de artigos, Wikipedia ou blogs. O VideoLM vai estudar o conteúdo e criar um vídeo cinematográfico.
      </p>

      <textarea
        placeholder="Cole uma URL por linha..."
        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-all mb-4"
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        disabled={status !== 'idle' && status !== 'error'}
      />

      <button
        onClick={handleStartResearch}
        disabled={status !== 'idle' && status !== 'error'}
        className={`w-full py-3 rounded-xl font-bold transition-all ${
          status === 'idle' || status === 'error' 
          ? 'bg-blue-600 hover:bg-blue-500 text-white' 
          : 'bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
      >
        {status === 'idle' ? '🚀 Iniciar Pesquisa Autônoma' : '⏳ Processando...'}
      </button>

      {log.length > 0 && (
        <div className="mt-6 bg-black/40 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-green-400 border border-gray-800">
          {log.map((msg, i) => <div key={i}>{msg}</div>)}
        </div>
      )}
    </div>
  );
};
