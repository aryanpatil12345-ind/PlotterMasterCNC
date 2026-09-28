import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Compass,
  Terminal,
  RotateCcw,
  Zap,
  Power,
  Trash2,
  Send,
  AlertTriangle,
  PenTool,
  CheckCircle2,
  LayoutGrid,
  Maximize2,
  Monitor,
  Sparkles
} from 'lucide-react';
import { SerialState, LogEntry, PlotJob, MachineConfig, Path } from '../types/plotter';
import { WebSerialManager } from '../utils/webSerial';
import { CNCLiveScreen } from './CNCLiveScreen';

interface CNCControllerProps {
  serialState: SerialState;
  serialManager: WebSerialManager | null;
  plotJob: PlotJob | null;
  machineConfig: MachineConfig;
  logs: LogEntry[];
  onClearLogs: () => void;
  onConnectSerial: () => void;
  onSimulateSerial: () => void;
  onNavigateToGcode?: () => void;
  onNavigateToVectorizer?: () => void;
  onNavigateToGallery?: () => void;
  paths?: Path[];
  imageSrc?: string | null;
  imageTitle?: string | null;
}

export const CNCController: React.FC<CNCControllerProps> = ({
  serialState,
  serialManager,
  plotJob,
  machineConfig,
  logs,
  onClearLogs,
  onConnectSerial,
  onSimulateSerial,
  onNavigateToGcode,
  onNavigateToVectorizer,
  onNavigateToGallery,
  paths = [],
  imageSrc,
  imageTitle,
}) => {
  const [jogStep, setJogStep] = useState<number>(10); // 0.1, 1, 10, 50 mm
  const [rawCommand, setRawCommand] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'split' | 'cinema'>('split');
  const cinemaTerminalContainerRef = useRef<HTMLDivElement>(null);
  const splitTerminalContainerRef = useRef<HTMLDivElement>(null);

  const isConnected =
    serialState.status === 'connected' ||
    serialState.status === 'streaming' ||
    serialState.status === 'paused';
  const isStreaming = serialState.status === 'streaming';
  const isPaused = serialState.status === 'paused';

  // Ensure paths fallback to plotJob.paths if empty
  const activePaths = paths.length > 0 ? paths : plotJob?.paths || [];

  // Autoscroll terminal container internally ONLY (never scroll window/page on mobile/small screen)
  useEffect(() => {
    if (autoScroll) {
      if (splitTerminalContainerRef.current) {
        splitTerminalContainerRef.current.scrollTop = splitTerminalContainerRef.current.scrollHeight;
      }
      if (cinemaTerminalContainerRef.current) {
        cinemaTerminalContainerRef.current.scrollTop = cinemaTerminalContainerRef.current.scrollHeight;
      }
    }
  }, [logs, autoScroll]);

  // Jog handlers
  const handleJog = (axis: 'X' | 'Y', direction: 1 | -1) => {
    if (!serialManager || !isConnected) return;
    const distance = jogStep * direction;
    // Relative coordinated move
    serialManager.sendRaw(`G91\nG0 ${axis}${distance.toFixed(2)} F${machineConfig.feedrateRapid}\nG90`);
  };

  const handlePenUp = () => {
    if (!serialManager || !isConnected) return;
    serialManager.sendRaw(`M3 S${machineConfig.penUpAngle}`);
  };

  const handlePenDown = () => {
    if (!serialManager || !isConnected) return;
    serialManager.sendRaw(`M3 S${machineConfig.penDownAngle}`);
  };

  const handleZeroAll = () => {
    if (!serialManager || !isConnected) return;
    serialManager.sendRaw('G92 X0 Y0');
  };

  const handleGoHome = () => {
    if (!serialManager || !isConnected) return;
    // Pen up first, then move to 0,0
    serialManager.sendRaw(`M3 S${machineConfig.penUpAngle}\nG0 X0 Y0 F${machineConfig.feedrateRapid}`);
  };

  const handleDisableMotors = () => {
    if (!serialManager || !isConnected) return;
    serialManager.sendRaw('M84');
  };

  const handleStartPlot = () => {
    if (!serialManager || !plotJob) return;
    serialManager.startStreaming(plotJob.gcodeLines);
  };

  const handleSendRaw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawCommand.trim() || !serialManager || !isConnected) return;
    serialManager.sendRaw(rawCommand.trim());
    setRawCommand('');
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.type === logFilter;
  });

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Top Controller Bar & Layout Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <span>CNC Machine Controller &amp; Live Pen Monitor</span>
              {isConnected && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ● {serialState.isVirtual ? 'Simulator' : 'Arduino Uno'}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-neutral-400">
              Real-time pen toolhead tracking, backdrop image preview, and G-Code stream controller.
            </p>
          </div>
        </div>

        {/* View Layout Switcher & Action Links */}
        <div className="flex items-center gap-2">
          {onNavigateToGallery && (
            <button
              onClick={onNavigateToGallery}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-medium text-xs transition-colors border border-neutral-700"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI &amp; Gallery</span>
            </button>
          )}

          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setLayoutMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                layoutMode === 'split'
                  ? 'bg-neutral-800 text-amber-400 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Screen and controller side-by-side"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Split Console</span>
            </button>
            <button
              onClick={() => setLayoutMode('cinema')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                layoutMode === 'cinema'
                  ? 'bg-neutral-800 text-amber-400 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Maximized bed screen view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Cinema Bed</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Cinema Mode (Screen spans full width, controls below) */}
      {layoutMode === 'cinema' && (
        <div className="space-y-4">
          {/* Full Width Live Screen */}
          <div className="h-[560px] w-full">
            <CNCLiveScreen
              paths={activePaths}
              plotJob={plotJob}
              machineConfig={machineConfig}
              serialState={serialState}
              imageSrc={imageSrc}
              imageTitle={imageTitle}
              penThicknessMm={0.5}
              onNavigateToVectorizer={onNavigateToVectorizer}
              onNavigateToGallery={onNavigateToGallery}
              onJog={handleJog}
            />
          </div>

          {/* 3-Column Panel Below Screen */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* 1. Execution Card (4 cols) */}
            <div className="md:col-span-4 bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="font-semibold text-neutral-100 text-xs">Plot Streamer</h3>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {serialState.progressPercent}%
                  </span>
                </div>

                {/* Main Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {!isStreaming && !isPaused ? (
                    <button
                      onClick={handleStartPlot}
                      disabled={!isConnected || !plotJob || plotJob.paths.length === 0}
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md shadow-amber-500/10 disabled:opacity-40 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-neutral-950" />
                      <span>Start Pen Plot</span>
                    </button>
                  ) : isStreaming ? (
                    <button
                      onClick={() => serialManager?.pauseStreaming()}
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Plot</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => serialManager?.resumeStreaming()}
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-neutral-950" />
                      <span>Resume Plot</span>
                    </button>
                  )}

                  {(isStreaming || isPaused) && (
                    <button
                      onClick={() => serialManager?.abortStreaming()}
                      className="flex items-center gap-1.5 px-3 py-2.5 bg-red-600/90 hover:bg-red-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                      title="Immediate Stop: lifts pen and disables steppers"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Abort</span>
                    </button>
                  )}
                </div>

                {!isConnected && (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={onConnectSerial}
                      className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg text-xs transition-colors text-center"
                    >
                      Connect USB
                    </button>
                    <button
                      onClick={onSimulateSerial}
                      className="flex-1 py-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-amber-400 font-medium rounded-lg text-xs transition-colors text-center"
                    >
                      Simulator
                    </button>
                  </div>
                )}

                {/* Progress bar */}
                <div className="space-y-1 mb-3">
                  <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-150"
                      style={{ width: `${serialState.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                    <span>
                      {serialState.currentLineIndex} / {serialState.totalLines} lines
                    </span>
                    <span>{serialState.status}</span>
                  </div>
                </div>
              </div>

              {/* Digital Readout (DRO) */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800">
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-2 text-center">
                  <span className="text-[9px] text-neutral-500 uppercase font-mono">X Axis</span>
                  <p className="text-sm font-bold font-mono text-cyan-400 tabular-nums">
                    {serialState.currentCoordinates.x.toFixed(2)}
                  </p>
                </div>
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-2 text-center">
                  <span className="text-[9px] text-neutral-500 uppercase font-mono">Y Axis</span>
                  <p className="text-sm font-bold font-mono text-cyan-400 tabular-nums">
                    {serialState.currentCoordinates.y.toFixed(2)}
                  </p>
                </div>
                <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-2 text-center">
                  <span className="text-[9px] text-neutral-500 uppercase font-mono">Pen Servo</span>
                  <p
                    className={`text-sm font-bold font-mono tabular-nums ${
                      serialState.currentCoordinates.penDown ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    {serialState.currentCoordinates.penDown ? 'DOWN' : 'UP'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Manual Jog Card (4 cols) */}
            <div className="md:col-span-4 bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-3">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <h3 className="font-semibold text-neutral-100 text-xs">Manual Jog &amp; Work Zero</h3>
                  </div>
                  {/* Step Selector */}
                  <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded p-0.5 font-mono text-[10px]">
                    {[0.1, 1, 10, 50].map((s) => (
                      <button
                        key={s}
                        onClick={() => setJogStep(s)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          jogStep === s ? 'bg-neutral-800 text-amber-400 font-semibold' : 'text-neutral-400'
                        }`}
                      >
                        {s}mm
                      </button>
                    ))}
                  </div>
                </div>

                {/* D-Pad */}
                <div className="flex flex-col items-center justify-center my-1">
                  <button
                    onClick={() => handleJog('Y', 1)}
                    disabled={!isConnected || isStreaming}
                    className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                    title="Jog Y+"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-3 my-1">
                    <button
                      onClick={() => handleJog('X', -1)}
                      disabled={!isConnected || isStreaming}
                      className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                      title="Jog X-"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-7 h-7 rounded-full border border-neutral-700 flex items-center justify-center text-[9px] font-mono text-neutral-400 select-none">
                      XY
                    </div>
                    <button
                      onClick={() => handleJog('X', 1)}
                      disabled={!isConnected || isStreaming}
                      className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                      title="Jog X+"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleJog('Y', -1)}
                    disabled={!isConnected || isStreaming}
                    className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                    title="Jog Y-"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Calibration Buttons */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-neutral-800">
                <button
                  onClick={handlePenUp}
                  disabled={!isConnected || isStreaming}
                  className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] font-medium transition-colors disabled:opacity-40"
                >
                  Pen UP
                </button>
                <button
                  onClick={handlePenDown}
                  disabled={!isConnected || isStreaming}
                  className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-rose-300 rounded text-[11px] font-medium transition-colors disabled:opacity-40"
                >
                  Pen DOWN
                </button>
                <button
                  onClick={handleZeroAll}
                  disabled={!isConnected || isStreaming}
                  className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 rounded text-[11px] font-medium transition-colors disabled:opacity-40"
                  title="G92 X0 Y0"
                >
                  Zero (G92)
                </button>
                <button
                  onClick={handleGoHome}
                  disabled={!isConnected || isStreaming}
                  className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[11px] font-medium transition-colors disabled:opacity-40"
                  title="Go to 0,0"
                >
                  Go Home (0,0)
                </button>
              </div>
            </div>

            {/* 3. Serial Terminal Card (4 cols) */}
            <div className="md:col-span-4 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[280px]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/90">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-neutral-200">Terminal (115200)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAutoScroll((prev) => !prev)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors flex items-center gap-0.5 cursor-pointer ${
                      autoScroll
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                    title={autoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is OFF'}
                  >
                    <ArrowDown className="w-2.5 h-2.5" />
                    <span>Auto</span>
                  </button>
                  <button
                    onClick={onClearLogs}
                    className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    title="Clear terminal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                ref={cinemaTerminalContainerRef}
                className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1 bg-neutral-950"
              >
                {filteredLogs.length === 0 ? (
                  <div className="text-neutral-600 text-center py-8">Terminal idle.</div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-neutral-600 text-[9px] shrink-0">{log.timestamp}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-semibold shrink-0 ${
                          log.type === 'sent'
                            ? 'bg-cyan-950 text-cyan-400'
                            : log.type === 'received'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-neutral-800 text-amber-400'
                        }`}
                      >
                        {log.type === 'sent' ? 'TX' : log.type === 'received' ? 'RX' : 'SYS'}
                      </span>
                      <span className="text-neutral-300 break-all">{log.text}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendRaw} className="p-1.5 border-t border-neutral-800 bg-neutral-900 flex gap-1.5">
                <input
                  type="text"
                  value={rawCommand}
                  onChange={(e) => setRawCommand(e.target.value)}
                  placeholder="G-code command (e.g. G0 X50 Y50, M3 S90)..."
                  disabled={!isConnected}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-[11px] font-mono text-neutral-100 placeholder:text-neutral-600 focus:outline-hidden focus:border-amber-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isConnected || !rawCommand.trim()}
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-medium disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Split Mode (Screen on left 7 cols, Controls & Terminal on right 5 cols) */}
      {layoutMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column (7 cols): The Screen & Plot Execution Hero */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* The Live Bed Screen Component */}
            <div className="h-[520px] w-full">
              <CNCLiveScreen
                paths={activePaths}
                plotJob={plotJob}
                machineConfig={machineConfig}
                serialState={serialState}
                imageSrc={imageSrc}
                imageTitle={imageTitle}
                penThicknessMm={0.5}
                onNavigateToVectorizer={onNavigateToVectorizer}
                onNavigateToGallery={onNavigateToGallery}
                onJog={handleJog}
              />
            </div>

            {/* Plot Execution Hero Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-100">Plot Stream Execution</h3>
                </div>

                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{serialState.isVirtual ? 'Simulator' : 'Arduino Uno Connected'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono">
                      <span className="w-2 h-2 rounded-full bg-neutral-600" />
                      <span>Not Connected</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-3">
                {!isStreaming && !isPaused ? (
                  <button
                    onClick={handleStartPlot}
                    disabled={!isConnected || !plotJob || plotJob.paths.length === 0}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md shadow-amber-500/10 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-neutral-950" />
                    <span>Start Pen Plot</span>
                  </button>
                ) : isStreaming ? (
                  <button
                    onClick={() => serialManager?.pauseStreaming()}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause Plot</span>
                  </button>
                ) : (
                  <button
                    onClick={() => serialManager?.resumeStreaming()}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-neutral-950" />
                    <span>Resume Plot</span>
                  </button>
                )}

                {(isStreaming || isPaused) && (
                  <button
                    onClick={() => serialManager?.abortStreaming()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600/90 hover:bg-red-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    title="Immediate Stop: lifts pen and disables steppers"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Emergency Stop</span>
                  </button>
                )}

                {!isConnected && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={onConnectSerial}
                      className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg text-xs transition-colors"
                    >
                      Connect USB Serial
                    </button>
                    <button
                      onClick={onSimulateSerial}
                      className="px-3 py-2 bg-neutral-800/80 hover:bg-neutral-700 text-amber-400 font-medium rounded-lg text-xs transition-colors"
                    >
                      Launch Simulator
                    </button>
                  </div>
                )}
              </div>

              {/* No G-Code loaded prompt */}
              {(!plotJob || plotJob.paths.length === 0) && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>No G-Code loaded for plotting yet.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onNavigateToGallery && (
                      <button
                        onClick={onNavigateToGallery}
                        className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded text-[11px] transition-colors"
                      >
                        Choose from Gallery
                      </button>
                    )}
                    {onNavigateToVectorizer && (
                      <button
                        onClick={onNavigateToVectorizer}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded text-[11px] transition-colors"
                      >
                        Vectorize Image
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Progress Bar & Line Status */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-400">
                    {isStreaming
                      ? 'Streaming G-Code to Steppers...'
                      : isPaused
                      ? 'Paused'
                      : isConnected
                      ? 'Ready to plot'
                      : 'Connect plotter to begin'}
                  </span>
                  <span className="text-neutral-200 font-semibold tabular-nums">
                    {serialState.progressPercent}% ({serialState.currentLineIndex} / {serialState.totalLines} lines)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-150"
                    style={{ width: `${serialState.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Digital Readout (DRO) */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-neutral-800">
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-neutral-500 uppercase font-mono">X Axis</span>
                  <p className="text-base font-bold font-mono text-cyan-400 tabular-nums">
                    {serialState.currentCoordinates.x.toFixed(2)}
                    <span className="text-xs text-neutral-500 font-normal ml-0.5">mm</span>
                  </p>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-neutral-500 uppercase font-mono">Y Axis</span>
                  <p className="text-base font-bold font-mono text-cyan-400 tabular-nums">
                    {serialState.currentCoordinates.y.toFixed(2)}
                    <span className="text-xs text-neutral-500 font-normal ml-0.5">mm</span>
                  </p>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-neutral-500 uppercase font-mono">Pen Servo</span>
                  <p
                    className={`text-base font-bold font-mono tabular-nums ${
                      serialState.currentCoordinates.penDown ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    {serialState.currentCoordinates.penDown ? 'DOWN' : 'UP'}
                    <span className="text-xs text-neutral-500 font-normal ml-1">
                      ({serialState.currentCoordinates.penDown ? machineConfig.penDownAngle : machineConfig.penUpAngle}°)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Manual Jog & Serial Terminal */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Manual Jog Controls & Calibration */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-200">Manual Jog &amp; Diagnostics</h3>
                </div>
                {/* Step Size Selector */}
                <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-md p-0.5 font-mono text-[11px]">
                  {[0.1, 1, 10, 50].map((s) => (
                    <button
                      key={s}
                      onClick={() => setJogStep(s)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        jogStep === s ? 'bg-neutral-800 text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {s}mm
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* 4-Way D-Pad for X & Y */}
                <div className="flex flex-col items-center justify-center p-1">
                  <button
                    onClick={() => handleJog('Y', 1)}
                    disabled={!isConnected || isStreaming}
                    className="w-11 h-11 bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500/20 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                    title="Jog Y+"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-3 my-1">
                    <button
                      onClick={() => handleJog('X', -1)}
                      disabled={!isConnected || isStreaming}
                      className="w-11 h-11 bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500/20 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                      title="Jog X-"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] font-mono text-neutral-400 select-none">
                      XY
                    </div>
                    <button
                      onClick={() => handleJog('X', 1)}
                      disabled={!isConnected || isStreaming}
                      className="w-11 h-11 bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500/20 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                      title="Jog X+"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleJog('Y', -1)}
                    disabled={!isConnected || isStreaming}
                    className="w-11 h-11 bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500/20 text-neutral-200 hover:text-amber-400 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                    title="Jog Y-"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePenUp}
                      disabled={!isConnected || isStreaming}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                    >
                      <PenTool className="w-3.5 h-3.5 text-amber-400" />
                      <span>Test UP</span>
                    </button>
                    <button
                      onClick={handlePenDown}
                      disabled={!isConnected || isStreaming}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                    >
                      <PenTool className="w-3.5 h-3.5 text-rose-400" />
                      <span>Test DOWN</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleZeroAll}
                      disabled={!isConnected || isStreaming}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                      title="G92 X0 Y0: Zero current position"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Zero (0,0)</span>
                    </button>
                    <button
                      onClick={handleGoHome}
                      disabled={!isConnected || isStreaming}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                      title="Go to Origin X0 Y0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Go to (0,0)</span>
                    </button>
                  </div>

                  <button
                    onClick={handleDisableMotors}
                    disabled={!isConnected || isStreaming}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                    title="M84: Disable steppers"
                  >
                    <Power className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Disable Steppers (M84)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Real-time Terminal / Serial Monitor */}
            <div className="flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm h-[380px]">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-800 bg-neutral-900/90">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-200">Serial Monitor (115200)</h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5 text-[10px] font-mono">
                    <button
                      onClick={() => setLogFilter('all')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${logFilter === 'all' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-500'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setLogFilter('sent')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${logFilter === 'sent' ? 'bg-neutral-800 text-cyan-400' : 'text-neutral-500'}`}
                    >
                      TX
                    </button>
                    <button
                      onClick={() => setLogFilter('received')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${logFilter === 'received' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-500'}`}
                    >
                      RX
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAutoScroll((prev) => !prev)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                      autoScroll
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                    title={autoScroll ? 'Terminal auto-scroll is ON' : 'Terminal auto-scroll is OFF'}
                  >
                    <ArrowDown className="w-2.5 h-2.5" />
                    <span>Auto</span>
                  </button>

                  <button
                    onClick={onClearLogs}
                    className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    title="Clear terminal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Logs Stream */}
              <div
                ref={splitTerminalContainerRef}
                className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1 bg-neutral-950"
              >
                {filteredLogs.length === 0 ? (
                  <div className="text-neutral-600 text-center py-12 font-mono">
                    Terminal idle. Connect plotter to view live serial output.
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-neutral-600 select-none text-[10px] shrink-0">{log.timestamp}</span>
                      <span
                        className={`shrink-0 font-semibold text-[10px] px-1 py-0.2 rounded ${
                          log.type === 'sent'
                            ? 'bg-cyan-950 text-cyan-400'
                            : log.type === 'received'
                            ? 'bg-emerald-950 text-emerald-400'
                            : log.type === 'error'
                            ? 'bg-rose-950 text-rose-400'
                            : 'bg-neutral-800 text-amber-400'
                        }`}
                      >
                        {log.type === 'sent' ? 'TX>' : log.type === 'received' ? '<RX' : 'SYS'}
                      </span>
                      <span
                        className={`break-all ${
                          log.type === 'sent'
                            ? 'text-neutral-200'
                            : log.type === 'received'
                            ? 'text-emerald-300'
                            : log.type === 'error'
                            ? 'text-rose-400'
                            : 'text-neutral-400'
                        }`}
                      >
                        {log.text}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Command Input Box */}
              <form onSubmit={handleSendRaw} className="p-2 border-t border-neutral-800 bg-neutral-900 flex gap-2">
                <input
                  type="text"
                  value={rawCommand}
                  onChange={(e) => setRawCommand(e.target.value)}
                  placeholder={isConnected ? 'Type G-code (G1 X20 Y20 F1000, M3 S90, ?)...' : 'Connect to send commands'}
                  disabled={!isConnected}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-100 placeholder:text-neutral-600 focus:outline-hidden focus:border-amber-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isConnected || !rawCommand.trim()}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
