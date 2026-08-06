'use client';

import { useEffect, useState } from 'react';

interface TypewriterTerminalProps {
  lines: string[];
  onComplete?: () => void;
}

export function TypewriterTerminal({ lines, onComplete }: TypewriterTerminalProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  useEffect(() => {
    if (lines.length === 0) return;

    if (currentLineIndex >= lines.length) {
      onComplete?.();
      return;
    }

    const currentFullLine = lines[currentLineIndex];
    if (currentCharIndex < currentFullLine.length) {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => {
          const next = [...prev];
          if (next[currentLineIndex] === undefined) {
            next[currentLineIndex] = '';
          }
          next[currentLineIndex] += currentFullLine[currentCharIndex];
          return next;
        });
        setCurrentCharIndex((prev) => prev + 1);
      }, 10); // 10ms for fast and smooth typing of details
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setCurrentLineIndex((prev) => prev + 1);
        setCurrentCharIndex(0);
      }, 80); // Quick transition to next line
      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, currentCharIndex, lines, onComplete]);

  return (
    <div className="font-mono text-xs sm:text-sm text-green-400 space-y-1.5 leading-relaxed select-text selection:bg-green-500 selection:text-black">
      {visibleLines.map((line, idx) => {
        const isHeader = line.startsWith('---');
        return (
          <div
            key={idx}
            className={
              isHeader
                ? 'text-amber-400 font-bold mt-4 mb-2 tracking-wide'
                : 'pl-3 border-l border-green-500/20'
            }
          >
            {line}
          </div>
        );
      })}
      {currentLineIndex < lines.length && (
        <span className="inline-block w-2.5 h-4 bg-green-400 animate-pulse ml-1" />
      )}
    </div>
  );
}
