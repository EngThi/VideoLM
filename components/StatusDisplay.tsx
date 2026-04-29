
import React, { useRef, useEffect, useState } from 'react';
import type { PipelineStage, ScriptResult } from '../types';
import { io } from 'socket.io-client';

interface StatusDisplayProps {
  stages: PipelineStage[];
  logs: string[];
  scriptResult: ScriptResult | null;
}

const StatusIcon: React.FC<{ status: PipelineStage['status'] }> = ({ status }) => {
  switch (status) {
    case 'PENDING':
      return <div className="w-3 h-3 rounded-full bg-gray-500" title="Pending"></div>;
    case 'IN_PROGRESS':
      return (
        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" title="In Progress"></div>
      );
    case 'COMPLETED':
      return (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
        </svg>
      );
    case 'FAILED':
        return (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        );
    default:
      return null;
  }
};

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ stages, logs, scriptResult }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
      // Connect to WebSocket only if Video Assembly is in progress
      const assemblyStage = stages.find(s => s.id === 'VIDEO_ASSEMBLY');
      
      if (assemblyStage?.status === 'IN_PROGRESS') {
          // Connect to current host (proxied by Vite to backend)
          const socket = io(); 

          socket.on('connect', () => {
              console.log('Connected to Progress WebSocket');
              socket.emit('subscribe', 'dev-session');
          });

          socket.on('progress:dev-session', (data: { progress: number, stage: string }) => {
              setProgress(data.progress);
          });

          return () => {
              socket.disconnect();
          };
      } else if (assemblyStage?.status === 'COMPLETED') {
          setProgress(100);
      } else {
          setProgress(0);
      }
  }, [stages]);

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-white/10 bg-[#101418]/95 p-5 shadow-2xl">
      <div>
        <div className="mb-4 border-b border-white/10 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#338eda]">Runtime</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">Pipeline Status</h2>
        </div>
        
         {/* Progress Bar (Visible only during assembly or when done) */}
         {(stages.find(s => s.id === 'VIDEO_ASSEMBLY')?.status === 'IN_PROGRESS' || progress > 0) && (
          <div className="mb-6 animate-fade-in">
              <div className="flex justify-between text-xs text-emerald-200 mb-1">
                  <span>Rendering Video (Ken Burns Engine)</span>
                  <span>{progress}%</span>
              </div>
              <div className="w-full overflow-hidden rounded-sm bg-white/10 h-2.5">
                  <div 
                      className="h-2.5 rounded-sm bg-[#33d6a6] transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                  ></div>
              </div>
          </div>
      )}

        <ul className="space-y-3">
          {stages.map((stage) => (
            <li key={stage.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <StatusIcon status={stage.status} />
                <span className={`${stage.status === 'COMPLETED' ? 'text-slate-500' : 'text-slate-200'} ${stage.status === 'IN_PROGRESS' ? 'font-bold text-white' : ''}`}>
                    {stage.name}
                </span>
              </div>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 sm:inline">
                {stage.status.replace('_', ' ')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {scriptResult && (
        <div className="animate-fade-in border-t border-white/10 pt-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white mb-2">Generated Script & Sources</h3>
            <div className="mb-4 h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-300 scroll-smooth">
                 <p className="whitespace-pre-wrap">{scriptResult.scriptText}</p>
            </div>
            <h4 className="text-sm font-bold text-slate-300 mb-2">Sources Used</h4>
            <ul className="text-xs space-y-1">
                {scriptResult.sources.map((source, index) => {
                    const href = typeof source === 'string' ? source : source.uri || source.url || '#';
                    const title = typeof source === 'string' ? source : source.title || source.uri || source.url || `Source ${index + 1}`;
                    return (
                    <li key={index}>
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:text-emerald-200 flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            <span className="truncate">{title}</span>
                        </a>
                    </li>
                    );
                })}
            </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white mb-2">Process Log</h3>
        <div ref={logContainerRef} className="h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-400 scroll-smooth">
          {logs.length === 0 ? (
            <p className="text-slate-600">Waiting for a pipeline run...</p>
          ) : logs.map((log, i) => (
            <p key={i} className="whitespace-pre-wrap">{log}</p>
          ))}
        </div>
      </div>
    </section>
  );
};
