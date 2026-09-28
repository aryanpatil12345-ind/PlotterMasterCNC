import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileCode,
  Sparkles,
  Download,
  Copy,
  Check,
  Zap,
  Play,
  ArrowRight,
  Upload,
  RefreshCw,
  Compass,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Layers,
  Crosshair,
  Maximize2
} from 'lucide-react';
import { Path, MachineConfig, PlotJob } from '../types/plotter';
import { generateGCode, parseGCodeToPaths, generateCalibrationPattern } from '../utils/gcodeGenerator';
import { optimizePaths } from '../utils/imageVectorizer';

interface GcodeStudioProps {
  paths: Path[];
  machineConfig: MachineConfig;
  setMachineConfig: React.Dispatch<React.SetStateAction<MachineConfig>>;
  plotJob: PlotJob | null;
  setPlotJob: (job: PlotJob | null) => void;
  onSendToController: () => void;
  onOptimizePaths: () => void;
}

export const GcodeStudio: React.FC<GcodeStudioProps> = ({
  paths,
  machineConfig,
  setMachineConfig,
  plotJob,
  setPlotJob,
  onSendToController,
  onOptimizePaths,
}) => {
  const [activeMode, setActiveMode] = useState<'image' | 'calibration' | 'editor'>('image');
  const [editorText, setEditorText] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedCalibration, setSelectedCalibration] = useState<
    'boundary_box' | 'crosshair' | 'concentric_circles' | 'speed_ladder' | 'spiral_vortex'
  >('boundary_box');
  const [customPenUpCmd, setCustomPenUpCmd] = useState<string>(`M3 S${machineConfig.penUpAngle}`);
  const [customPenDownCmd, setCustomPenDownCmd] = useState<string>(`M3 S${machineConfig.penDownAngle}`);
  const [fileImportName, setFileImportName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync editorText with current plotJob
  useEffect(() => {
    if (plotJob?.gcode) {
      setEditorText(plotJob.gcode);
    }
  }, [plotJob?.gcode]);

  // Keep custom pen commands synced with machineConfig
  useEffect(() => {
    setCustomPenUpCmd(`M3 S${machineConfig.penUpAngle}`);
    setCustomPenDownCmd(`M3 S${machineConfig.penDownAngle}`);
  }, [machineConfig.penUpAngle, machineConfig.penDownAngle]);

  // Generate G-Code from current image paths
  const handleGenerateFromImage = () => {
    if (paths.length === 0) return;
    const job = generateGCode(paths, machineConfig);
    setPlotJob(job);
    setEditorText(job.gcode);
  };

  // Generate G-code from calibration pattern
  const handleGenerateCalibration = (type: typeof selectedCalibration) => {
    setSelectedCalibration(type);
    const patternPaths = generateCalibrationPattern(type, machineConfig);
    const job = generateGCode(patternPaths, machineConfig);
    setPlotJob(job);
    setEditorText(job.gcode);
  };

  // Parse custom text in editor back into plotJob
  const handleApplyEditorText = () => {
    if (!editorText.trim()) return;
    const job = parseGCodeToPaths(editorText, machineConfig);
    setPlotJob(job);
  };

  // Handle file import (.gcode, .nc, .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileImportName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setEditorText(content);
        const job = parseGCodeToPaths(content, machineConfig);
        setPlotJob(job);
        setActiveMode('editor');
      }
    };
    reader.readAsText(file);
  };

  const handleCopy = () => {
    if (!editorText) return;
    navigator.clipboard.writeText(editorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!editorText) return;
    const blob = new Blob([editorText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plotter_${machineConfig.bedWidth}x${machineConfig.bedHeight}mm.gcode`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render 2D bed preview on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bedW = machineConfig.bedWidth;
    const bedH = machineConfig.bedHeight;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f0f12';
    ctx.fillRect(0, 0, w, h);

    const padding = 28;
    const availW = w - padding * 2;
    const availH = h - padding * 2;
    const scale = Math.min(availW / bedW, availH / bedH);

    const bedPixelW = bedW * scale;
    const bedPixelH = bedH * scale;

    const offsetX = padding + (availW - bedPixelW) / 2;
    const offsetY = padding + (availH - bedPixelH) / 2;

    const mmToScreen = (xMm: number, yMm: number): [number, number] => {
      const sx = offsetX + xMm * scale;
      const sy = offsetY + (bedH - yMm) * scale;
      return [sx, sy];
    };

    // Bed background
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1;
    ctx.fillRect(offsetX, offsetY, bedPixelW, bedPixelH);
    ctx.strokeRect(offsetX, offsetY, bedPixelW, bedPixelH);

    // Bed grid
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let x = 10; x < bedW; x += 10) {
      const [sx] = mmToScreen(x, 0);
      ctx.moveTo(sx, offsetY);
      ctx.lineTo(sx, offsetY + bedPixelH);
    }
    for (let y = 10; y < bedH; y += 10) {
      const [, sy] = mmToScreen(0, y);
      ctx.moveTo(offsetX, sy);
      ctx.lineTo(offsetX + bedPixelW, sy);
    }
    ctx.stroke();

    // Rulers (50mm)
    ctx.fillStyle = '#737373';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let x = 50; x < bedW; x += 50) {
      const [sx] = mmToScreen(x, 0);
      ctx.fillText(`${x}`, sx, offsetY + bedPixelH + 12);
    }
    ctx.textAlign = 'right';
    for (let y = 50; y < bedH; y += 50) {
      const [, sy] = mmToScreen(0, y);
      ctx.fillText(`${y}`, offsetX - 6, sy + 3);
    }

    // Origin
    const [ox, oy] = mmToScreen(0, 0);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + 16, oy);
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox, oy - 16);
    ctx.stroke();

    // Draw strokes from plotJob
    if (plotJob && plotJob.paths.length > 0) {
      let lastPoint: [number, number] | null = [0, 0];

      plotJob.paths.forEach((path) => {
        if (path.length === 0) return;

        // Rapid line to start
        if (lastPoint) {
          const [rx1, ry1] = mmToScreen(lastPoint[0], lastPoint[1]);
          const [rx2, ry2] = mmToScreen(path[0][0], path[0][1]);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
          ctx.setLineDash([2, 3]);
          ctx.moveTo(rx1, ry1);
          ctx.lineTo(rx2, ry2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const [sx0, sy0] = mmToScreen(path[0][0], path[0][1]);
        ctx.moveTo(sx0, sy0);

        for (let i = 1; i < path.length; i++) {
          const [px, py] = mmToScreen(path[i][0], path[i][1]);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        lastPoint = path[path.length - 1];
      });
    }
  }, [plotJob, machineConfig]);

  const lineCount = useMemo(() => {
    return editorText.split('\n').filter((l) => l.trim().length > 0).length;
  }, [editorText]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex flex-col gap-5 text-xs">
      {/* Hero Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-md mb-2">
              <FileCode className="w-3.5 h-3.5" />
              <span>G-Code Generator &amp; Studio</span>
            </div>
            <h2 className="text-xl font-bold text-neutral-100 tracking-tight">
              Create, Inspect &amp; Fine-Tune G-Code
            </h2>
            <p className="text-neutral-400 text-xs mt-1 max-w-2xl leading-relaxed">
              Generate industrial-standard G-Code for your 3-stepper 1-servo Arduino Uno pen plotter. Create from image vectors, generate mechanical calibration patterns, or paste and edit custom G-Code.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSendToController}
              disabled={!plotJob || lineCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md shadow-amber-500/10 disabled:opacity-40 cursor-pointer"
            >
              <span>Send to CNC Controller</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Source Mode Switcher */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-neutral-800">
          <button
            onClick={() => setActiveMode('image')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeMode === 'image'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>From Vectorized Image</span>
          </button>

          <button
            onClick={() => setActiveMode('calibration')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeMode === 'calibration'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Calibration &amp; Test Patterns</span>
          </button>

          <button
            onClick={() => setActiveMode('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeMode === 'editor'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>G-Code Text Editor &amp; Import</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Generator Controls & Editor (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Mode 1: From Image */}
          {activeMode === 'image' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-200">Image Vector Toolpath Settings</h3>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  {paths.length.toLocaleString()} active paths
                </span>
              </div>

              {paths.length === 0 ? (
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg text-center">
                  <AlertCircle className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-neutral-300">No Image Vectors Loaded Yet</p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Upload an image in the <strong>Image Vectorizer</strong> tab or click below to load sample vectors.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Vectors ready: {paths.length.toLocaleString()} strokes</span>
                  </div>
                  <button
                    onClick={onOptimizePaths}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 hover:bg-emerald-900 rounded border border-emerald-800 transition-colors flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Optimize Rapid Travel</span>
                  </button>
                </div>
              )}

              {/* Feedrate and Servo Tuning */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                    <span>Draw Feedrate (G1)</span>
                    <span className="font-mono text-neutral-200">{machineConfig.feedrateDraw} mm/min</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="4000"
                    step="50"
                    value={machineConfig.feedrateDraw}
                    onChange={(e) =>
                      setMachineConfig((prev) => ({ ...prev, feedrateDraw: parseInt(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                    <span>Rapid Travel (G0)</span>
                    <span className="font-mono text-neutral-200">{machineConfig.feedrateRapid} mm/min</span>
                  </div>
                  <input
                    type="range"
                    min="800"
                    max="6000"
                    step="100"
                    value={machineConfig.feedrateRapid}
                    onChange={(e) =>
                      setMachineConfig((prev) => ({ ...prev, feedrateRapid: parseInt(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">Pen UP Servo Command</label>
                  <input
                    type="text"
                    value={customPenUpCmd}
                    onChange={(e) => setCustomPenUpCmd(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-hidden focus:border-amber-500"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Default: M3 S35 (or M5)</p>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">Pen DOWN Servo Command</label>
                  <input
                    type="text"
                    value={customPenDownCmd}
                    onChange={(e) => setCustomPenDownCmd(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-hidden focus:border-amber-500"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Default: M3 S95 (or M3 S1000)</p>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                    <span>Servo Settle Delay</span>
                    <span className="font-mono text-neutral-200">{machineConfig.penLiftDelayMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="25"
                    value={machineConfig.penLiftDelayMs}
                    onChange={(e) =>
                      setMachineConfig((prev) => ({ ...prev, penLiftDelayMs: parseInt(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateFromImage}
                disabled={paths.length === 0}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                <span>Re-Generate &amp; Build G-Code</span>
              </button>
            </div>
          )}

          {/* Mode 2: Calibration Patterns */}
          {activeMode === 'calibration' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-200">Hardware Calibration Patterns</h3>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono">Instant G-Code</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'boundary_box',
                    name: 'Bed Margin Box & Corners',
                    desc: 'Draws outer perimeter rectangle with 15mm corner diagonals to check squareness.',
                  },
                  {
                    id: 'crosshair',
                    name: 'Centered Crosshair with 10mm Ticks',
                    desc: 'Precision millimeter ticks to measure X and Y steps/mm scale with a physical ruler.',
                  },
                  {
                    id: 'concentric_circles',
                    name: 'Concentric Circles (Backlash Test)',
                    desc: 'Multiple concentric circles to verify belt tension and smooth circular interpolation.',
                  },
                  {
                    id: 'speed_ladder',
                    name: 'Speed & Acceleration Ladder',
                    desc: 'Parallel strokes to test high-speed drawing without skipping stepper steps.',
                  },
                  {
                    id: 'spiral_vortex',
                    name: 'Continuous Spiral Vortex',
                    desc: 'Single unbroken Archimedean spiral to test continuous multi-axis motion.',
                  },
                ].map((pat) => (
                  <button
                    key={pat.id}
                    onClick={() => handleGenerateCalibration(pat.id as any)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedCalibration === pat.id
                        ? 'border-amber-400 bg-amber-500/10 text-neutral-100 shadow-xs'
                        : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-xs ${selectedCalibration === pat.id ? 'text-amber-400' : 'text-neutral-200'}`}>
                        {pat.name}
                      </span>
                      {selectedCalibration === pat.id && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-snug">{pat.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode 3: Text Editor & Import */}
          {activeMode === 'editor' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-neutral-200">G-Code Text Editor &amp; File Import</h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".gcode,.nc,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] transition-colors flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload .gcode</span>
                  </button>
                </div>
              </div>

              {fileImportName && (
                <div className="p-2 bg-neutral-950 border border-neutral-800 rounded-md text-[11px] text-neutral-400 font-mono flex items-center justify-between">
                  <span>Imported: {fileImportName}</span>
                  <span className="text-amber-400">{lineCount.toLocaleString()} lines</span>
                </div>
              )}

              {/* Text Area */}
              <div className="relative">
                <textarea
                  value={editorText}
                  onChange={(e) => setEditorText(e.target.value)}
                  placeholder="Paste or write raw G-Code here (G0, G1, M3, M5, etc.)..."
                  className="w-full h-72 bg-neutral-950 border border-neutral-800 rounded-lg p-3 font-mono text-[11px] text-neutral-200 placeholder:text-neutral-600 focus:outline-hidden focus:border-amber-500 leading-relaxed resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-neutral-400 font-mono">
                  {lineCount.toLocaleString()} total G-Code lines
                </span>
                <button
                  onClick={handleApplyEditorText}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Parse &amp; Update Simulation</span>
                </button>
              </div>
            </div>
          )}

          {/* G-Code Actions: Copy & Download */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Current G-Code:</span>
              <span className="text-xs font-mono font-bold text-neutral-200">
                {lineCount.toLocaleString()} lines
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!editorText}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                disabled={!editorText}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 hover:border-amber-500/50 rounded-lg font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save .gcode</span>
              </button>

              <button
                onClick={onSendToController}
                disabled={!plotJob || lineCount === 0}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-40 cursor-pointer"
              >
                <span>Run in Controller</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 2D Bed Toolpath Visualizer (6 cols) */}
        <div className="lg:col-span-6 flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm h-[580px]">
          {/* Visualizer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/90">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-neutral-200">CNC Bed Toolpath Simulation</h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              {machineConfig.bedWidth}×{machineConfig.bedHeight} mm
            </span>
          </div>

          {/* Canvas Viewport */}
          <div className="relative flex-1 bg-neutral-950">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Legend */}
            <div className="absolute top-3 left-3 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800/80 rounded-lg px-2.5 py-1.5 flex items-center gap-3 text-[11px] font-mono pointer-events-none">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full" />
                <span className="text-neutral-300">Pen DOWN (G1)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-b border-dashed border-amber-400" />
                <span className="text-neutral-300">Pen UP (G0)</span>
              </div>
            </div>

            {(!plotJob || plotJob.paths.length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-neutral-950/80 backdrop-blur-xs">
                <Layers className="w-10 h-10 text-neutral-600 mb-2" />
                <p className="text-sm font-medium text-neutral-300">No G-Code Toolpaths to Display</p>
                <p className="text-xs text-neutral-500 max-w-sm mt-1">
                  Click &ldquo;Re-Generate &amp; Build G-Code&rdquo; or select a calibration pattern on the left to render toolpaths.
                </p>
              </div>
            )}
          </div>

          {/* Toolpath Bounding Box & Statistics Footer */}
          {plotJob && (
            <div className="grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 border-t border-neutral-800/80 bg-neutral-950 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-neutral-500 text-[10px] uppercase">Draw Length</span>
                <span className="text-cyan-400 font-semibold tabular-nums">
                  {(plotJob.totalDrawDistMm / 1000).toFixed(2)} m
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-neutral-500 text-[10px] uppercase">Rapid Travel</span>
                <span className="text-amber-400 font-semibold tabular-nums">
                  {(plotJob.totalRapidDistMm / 1000).toFixed(2)} m
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-neutral-500 text-[10px] uppercase">Pen Lifts</span>
                <span className="text-neutral-200 font-semibold tabular-nums">
                  {plotJob.penLiftsCount.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-neutral-500 text-[10px] uppercase">Est. Time</span>
                <span className="text-emerald-400 font-semibold tabular-nums">
                  ~{formatTime(plotJob.estimatedDurationSec)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
