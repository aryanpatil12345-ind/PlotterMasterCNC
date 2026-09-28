import React from 'react';
import { Cpu, Usb, Play, Code, Sliders, CheckCircle2, AlertCircle, RefreshCw, Sparkles, HelpCircle } from 'lucide-react';
import { SerialState } from '../types/plotter';

export type AppTab = 'gallery' | 'vectorizer' | 'gcode' | 'controller' | 'firmware' | 'help';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  serialState: SerialState;
  onConnectSerial: () => void;
  onDisconnectSerial: () => void;
  onSimulateSerial: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  serialState,
  onConnectSerial,
  onDisconnectSerial,
  onSimulateSerial,
}) => {
  const isConnected = serialState.status === 'connected' || serialState.status === 'streaming' || serialState.status === 'paused';
  const isStreaming = serialState.status === 'streaming';

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Single text element Brand Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-neutral-950 shadow-sm shadow-amber-500/20 font-bold">
            <Cpu className="w-4 h-4 text-neutral-950" />
          </div>
          <span className="text-base font-semibold tracking-tight text-neutral-100 whitespace-nowrap">
            PlotterCraft CNC
          </span>
          <span className="hidden sm:inline-block text-xs font-mono text-neutral-500">
            Uno 3-Axis + Servo
          </span>
        </div>

        {/* Zone 2: Navigation views */}
        <nav className="hidden md:flex items-center gap-1 bg-neutral-900/90 p-1 rounded-lg border border-neutral-800/70">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'gallery'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI &amp; Print Gallery</span>
          </button>

          <button
            onClick={() => setActiveTab('vectorizer')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'vectorizer'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>1. Image Vectorizer</span>
          </button>

          <button
            onClick={() => setActiveTab('gcode')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'gcode'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>2. G-Code Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('controller')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'controller'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>3. CNC Controller</span>
            {isStreaming && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('firmware')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'firmware'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>4. Firmware &amp; Wiring</span>
          </button>

          <button
            onClick={() => setActiveTab('help')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'help'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>5. Help &amp; Forum</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions (Serial Status & Connection) */}
        <div className="flex items-center gap-2.5">
          {isConnected ? (
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg pl-3 pr-1 py-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs max-w-[130px] truncate">
                  {serialState.isVirtual ? 'Simulated Uno' : serialState.portName}
                </span>
                <span className="text-neutral-500 font-mono text-[11px]">115.2k</span>
              </div>
              <button
                onClick={onDisconnectSerial}
                className="px-2.5 py-1 text-xs text-neutral-400 hover:text-red-400 hover:bg-neutral-800/80 rounded transition-colors"
                title="Disconnect Serial"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onConnectSerial}
                disabled={serialState.status === 'connecting'}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {serialState.status === 'connecting' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Usb className="w-3.5 h-3.5" />
                )}
                <span>Connect Arduino</span>
              </button>

              <button
                onClick={onSimulateSerial}
                className="hidden sm:inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors whitespace-nowrap"
                title="Simulate Arduino Uno hardware in browser without physical USB device"
              >
                Simulate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav buttons */}
      <div className="flex md:hidden items-center justify-around gap-1 mt-2.5 pt-2 border-t border-neutral-800/60 overflow-x-auto">
        <button
          onClick={() => setActiveTab('gallery')}
          className={`flex-1 py-1.5 px-2 text-center text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'gallery' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400'
          }`}
        >
          AI &amp; Gallery
        </button>
        <button
          onClick={() => setActiveTab('vectorizer')}
          className={`flex-1 py-1.5 px-2 text-center text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'vectorizer' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400'
          }`}
        >
          1. Vectorizer
        </button>
        <button
          onClick={() => setActiveTab('gcode')}
          className={`flex-1 py-1.5 px-2 text-center text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'gcode' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400'
          }`}
        >
          2. G-Code
        </button>
        <button
          onClick={() => setActiveTab('controller')}
          className={`flex-1 py-1.5 px-2 text-center text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'controller' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400'
          }`}
        >
          3. Controller
        </button>
        <button
          onClick={() => setActiveTab('firmware')}
          className={`flex-1 py-1.5 px-2 text-center text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'firmware' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400'
          }`}
        >
          4. Firmware
        </button>
        <button
          onClick={() => setActiveTab('help')}
          className={`flex-1 py-1.5 px-2 text-center text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'help' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400'
          }`}
        >
          5. Help
        </button>
      </div>
    </header>
  );
};
