
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
    <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white border-b border-gray-700 pb-3 mb-4">Pipeline Status</h2>
        
         {/* Progress Bar (Visible only during assembly or when done) */}
         {(stages.find(s => s.id === 'VIDEO_ASSEMBLY')?.status === 'IN_PROGRESS' || progress > 0) && (
          <div className="mb-6 animate-fade-in">
              <div className="flex justify-between text-xs text-blue-300 mb-1">
                  <span>Rendering Video (Ken Burns Engine)</span>
                  <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div 
                      className="bg-gradient-to-r from-blue-600 to-purple-500 h-2.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                      style={{ width: `${progress}%` }}
                  ></div>
              </div>
          </div>
      )}

        <ul className="space-y-3">
          {stages.map((stage) => (
            <li key={stage.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <StatusIcon status={stage.status} />
                <span className={`${stage.status === 'COMPLETED' ? 'text-gray-400' : 'text-gray-200'} ${stage.status === 'IN_PROGRESS' ? 'font-bold' : ''}`}>
                    {stage.name}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {scriptResult && (
        <div className="animate-fade-in border-t border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-white mb-2">Generated Script & Sources</h3>
            <div className="bg-black/30 rounded-lg p-3 h-40 overflow-y-auto font-mono text-xs text-gray-300 scroll-smooth mb-4">
                 <p className="whitespace-pre-wrap">{scriptResult.scriptText}</p>
            </div>
            <h4 className="text-md font-semibold text-white mb-2">Sources Used:</h4>
            <ul className="text-xs space-y-1">
                {scriptResult.sources.map((source, index) => (
                    <li key={index}>
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            {source.title}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Process Log</h3>
        <div ref={logContainerRef} className="bg-black/30 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs text-gray-400 scroll-smooth">
          {logs.map((log, i) => (
            <p key={i} className="whitespace-pre-wrap">{log}</p>
          ))}
        </div>
      </div>
    </div>
  );
};
