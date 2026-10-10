import React from 'react';

interface ImakoCreditProps {
  className?: string;
}

export function ImakoCredit({ className = '' }: ImakoCreditProps) {
  return (
    <a
      href="https://imakosolutions.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors group select-none ${className}`}
      title="Built by Imako Solution — imakosolutions.com"
    >
      <span className="font-medium text-slate-500 dark:text-slate-400">Built by</span>
      <span className="inline-flex items-center">
        {/* Light mode logo */}
        <img
          src="/imako-solution-logo.png"
          alt="Imako Solution"
          className="h-6 w-auto object-contain dark:hidden"
        />
        {/* Dark mode logo */}
        <img
          src="/imako-solution-logo-dark-mode.png"
          alt="Imako Solution"
          className="h-6 w-auto object-contain hidden dark:inline-block"
        />
      </span>
      <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:underline">
        Imako Solution
      </span>
      <span className="text-slate-300 dark:text-slate-600">•</span>
      <span className="text-[11px] text-slate-400 dark:text-slate-500 group-hover:text-sky-600 dark:group-hover:text-sky-400 font-normal">
        imakosolutions.com
      </span>
    </a>
  );
}

export default ImakoCredit;
