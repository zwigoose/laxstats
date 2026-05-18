import React, { useRef } from 'react';

const FieldMapInput = ({ onLocationSelected }) => {
  const containerRef = useRef(null);

  const handleClick = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onLocationSelected({ x, y });
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <h3 className="text-lg font-bold">Where was the shot taken?</h3>
      <div 
        ref={containerRef}
        onClick={handleClick}
        className="relative w-full max-w-md aspect-[4/3] bg-green-100 border-2 border-green-800 rounded-lg cursor-crosshair overflow-hidden shadow-inner"
      >
        <svg viewBox="0 0 100 75" className="w-full h-full select-none">
          {/* Grass/Field background */}
          <rect x="0" y="0" width="100" height="75" fill="#34d399" fillOpacity="0.2" />
          
          {/* End line */}
          <line x1="0" y1="75" x2="100" y2="75" stroke="#064e3b" strokeWidth="2" />
          {/* Goal crease */}
          <circle cx="50" cy="65" r="9" fill="none" stroke="#064e3b" strokeWidth="1" />
          {/* Goal line */}
          <line x1="44" y1="65" x2="56" y2="65" stroke="#064e3b" strokeWidth="2" />
          {/* Goal cage (simplified) */}
          <rect x="47" y="64.5" width="6" height="1" fill="#064e3b" />
          
          {/* Restraining line */}
          <line x1="0" y1="20" x2="100" y2="20" stroke="#064e3b" strokeWidth="1" strokeDasharray="2,2" />
          
          {/* Boundary lines */}
          <line x1="0" y1="0" x2="0" y2="75" stroke="#064e3b" strokeWidth="1" />
          <line x1="100" y1="0" x2="100" y2="75" stroke="#064e3b" strokeWidth="1" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <span className="text-4xl font-bold text-green-900 uppercase tracking-widest">Offensive Zone</span>
        </div>
      </div>
      <div className="flex space-x-2">
        <button 
          onClick={() => onLocationSelected({ x: null, y: null })}
          className="px-6 py-2 bg-gray-200 rounded-full text-gray-700 font-medium hover:bg-gray-300 transition-colors"
        >
          Skip Location
        </button>
      </div>
    </div>
  );
};

export default FieldMapInput;
