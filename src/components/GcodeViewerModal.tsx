import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode } from 'lucide-react';

interface GcodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gcode: string;
  filename?: string;
}

export const GcodeViewerModal: React.FC<GcodeViewerModalProps> = ({
  isOpen,
  onClose,
  gcode,
  filename = 'plot.gcode',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const lines = gcode.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(gcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-amber-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">{filename}</h3>
              <p className="text-xs text-neutral-400 font-mono">
                {lines.length.toLocaleString()} lines · {(new Blob([gcode]).size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy G-Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-lg transition-colors font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .gcode</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto bg-neutral-950 p-4 font-mono text-xs text-neutral-300">
          <div className="table w-full">
            {lines.slice(0, 1000).map((line, idx) => (
              <div key={idx} className="table-row hover:bg-neutral-900/60">
                <span className="table-cell pr-4 py-0.5 text-right select-none text-neutral-600 font-mono text-[11px] w-12">
                  {idx + 1}
                </span>
                <span
                  className={`table-cell py-0.5 whitespace-pre font-mono ${
                    line.startsWith(';')
                      ? 'text-neutral-500 italic'
                      : line.startsWith('G0')
                      ? 'text-amber-400'
                      : line.startsWith('G1')
                      ? 'text-cyan-400'
                      : line.startsWith('M3') || line.startsWith('M5')
                      ? 'text-rose-400 font-medium'
                      : 'text-neutral-200'
                  }`}
                >
                  {line}
                </span>
              </div>
            ))}
            {lines.length > 1000 && (
              <div className="text-center py-4 text-xs text-neutral-500 font-mono italic">
                ... ({lines.length - 1000} more lines omitted for browser performance. Download file for complete G-code) ...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
