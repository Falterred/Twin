// ─────────────────────────────────────────────────────────────
// HelpTooltip — Interactive help icon with tooltip
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  text: string;
  className?: string;
}

export function HelpTooltip({ text, className = '' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full
          text-slate-400 dark:text-slate-500
          hover:text-blue-500 dark:hover:text-blue-400
          hover:bg-blue-100 dark:hover:bg-blue-900/30
          transition-all duration-200 cursor-help"
        aria-label="Help"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2
          w-max max-w-xs bg-slate-900 dark:bg-slate-800
          text-white text-xs px-2.5 py-1.5 rounded-lg
          border border-slate-700 dark:border-slate-600
          shadow-xl pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200
          whitespace-normal leading-relaxed"
        >
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2
            border-4 border-transparent border-t-slate-900 dark:border-t-slate-800"
          />
        </div>
      )}
    </div>
  );
}
