
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-10">
      <div className="container mx-auto px-4 md:px-8 py-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wider">
          <span role="img" aria-label="film clapper">🎬</span> YouTube<span className="text-blue-400">Video</span>Master
        </h1>
        <p className="text-sm text-gray-400 mt-1">AI-Powered Video Production Pipeline</p>
      </div>
    </header>
  );
};
