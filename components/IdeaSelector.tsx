
import React from 'react';
import type { ContentIdea } from '../types';

interface IdeaSelectorProps {
  ideas: ContentIdea[];
  onSelect: (idea: ContentIdea) => void;
}

const IdeaCard: React.FC<{ idea: ContentIdea; onSelect: () => void; }> = ({ idea, onSelect }) => {
    return (
        <div className="bg-gray-700/50 rounded-xl p-5 border border-transparent hover:border-blue-500 transition-all duration-300 flex flex-col justify-between">
            <div>
                <h3 className="text-lg font-bold text-blue-400 mb-2">{idea.title}</h3>
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {idea.outline.split('\n').map((line, index) => (
                        <li key={index}>{line.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                </ul>
            </div>
            <button
                onClick={onSelect}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-transform duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
            >
                Choose This Plan
            </button>
        </div>
    );
}

export const IdeaSelector: React.FC<IdeaSelectorProps> = ({ ideas, onSelect }) => {
  return (
    <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 animate-fade-in">
      <h2 className="text-xl font-semibold text-white border-b border-gray-700 pb-3 mb-4">🧠 Choose Your Content Plan</h2>
      <p className="text-sm text-gray-400 mb-6">Select one of the AI-generated ideas below to start the video production pipeline.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        {ideas.map((idea, index) => (
          <IdeaCard key={index} idea={idea} onSelect={() => onSelect(idea)} />
        ))}
      </div>
    </div>
  );
};
