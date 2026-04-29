
import React from 'react';
import type { ContentIdea } from '../types';

interface IdeaSelectorProps {
  ideas: ContentIdea[];
  onSelect: (idea: ContentIdea) => void;
}

const IdeaCard: React.FC<{ idea: ContentIdea; onSelect: () => void; }> = ({ idea, onSelect }) => {
    return (
        <div className="flex flex-col justify-between rounded-lg border border-white/10 bg-black/25 p-5 transition-all duration-300 hover:border-emerald-300/40">
            <div>
                <h3 className="mb-2 text-lg font-black tracking-tight text-white">{idea.title}</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                    {idea.outline.split('\n').map((line, index) => (
                        <li key={index}>{line.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                </ul>
            </div>
            <button
                onClick={onSelect}
                className="mt-4 w-full rounded-md bg-[#33d6a6] px-4 py-2 font-black text-black transition duration-200 hover:bg-[#62e4bd] focus:outline-none focus:ring-4 focus:ring-emerald-300/20"
            >
                Choose This Plan
            </button>
        </div>
    );
}

export const IdeaSelector: React.FC<IdeaSelectorProps> = ({ ideas, onSelect }) => {
  return (
    <section className="animate-fade-in rounded-lg border border-white/10 bg-[#101418]/95 p-5 shadow-2xl">
      <div className="mb-4 border-b border-white/10 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f7c948]">Planning</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white">Choose Content Plan</h2>
      </div>
      <p className="mb-6 text-sm text-slate-400">Select one generated plan to start the video production pipeline.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        {ideas.map((idea, index) => (
          <IdeaCard key={index} idea={idea} onSelect={() => onSelect(idea)} />
        ))}
      </div>
    </section>
  );
};
