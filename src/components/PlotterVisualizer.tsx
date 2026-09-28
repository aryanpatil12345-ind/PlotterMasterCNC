import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Play, Pause, RotateCcw, Zap, FileCode, Download, Eye, Layers } from 'lucide-react';
import { Path, MachineConfig, PlotJob } from '../types/plotter';

interface PlotterVisualizerProps {
  paths: Path[];
  machineConfig: MachineConfig;
  penThicknessMm?: number;
  onOptimizePaths: () => void;
  onOpenGcodeModal: () => void;
  onDownloadGcode: () => void;
  plotJob: PlotJob | null;
  liveCoordinates?: { x: number; y: number; penDown: boolean } | null;
}

export const PlotterVisualizer: React.FC<PlotterVisualizerProps> = ({
  paths,
  machineConfig,
  penThicknessMm = 0.5,
  onOptimizePaths,
  onOpenGcodeModal,
  onDownloadGcode,
  plotJob,
  liveCoordinates,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(1); // 0 to 1
  const [speedMultiplier, setSpeedMultiplier] = useState(2); // 1x, 2x, 5x, 10x
  const [showRapidMoves, setShowRapidMoves] = useState(true);

  // Total points for scrub calculation
  const totalPoints = useMemo(() => {
    return paths.reduce((acc, p) => acc + p.length, 0);
  }, [paths]);

  // Animation frame loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isPlaying) {
        setPlaybackProgress((prev) => {
          // Duration based on total points and speed
          const baseDuration = Math.max(5, totalPoints * 0.005);
          const advance = (dt / baseDuration) * speedMultiplier;
          const next = prev + advance;
          if (next >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return next;
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, speedMultiplier, totalPoints]);

  // Render to Canvas
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

    // Clear background
    ctx.fillStyle = '#141416';
    ctx.fillRect(0, 0, w, h);

    // Compute scale and offset to fit bed in canvas with padding
    const padding = 36;
    const availW = w - padding * 2;
    const availH = h - padding * 2;
    const scale = Math.min(availW / bedW, availH / bedH);

    const bedPixelW = bedW * scale;
    const bedPixelH = bedH * scale;

    const offsetX = padding + (availW - bedPixelW) / 2;
    const offsetY = padding + (availH - bedPixelH) / 2;
    const centerX = offsetX + bedPixelW / 2;
    const centerY = offsetY + bedPixelH / 2;

    const halfW = bedW / 2;
    const halfH = bedH / 2;

    // Helper: mm to screen coordinates (origin [0,0] is right in the middle of the 500x500 bed)
    const mmToScreen = (xMm: number, yMm: number): [number, number] => {
      const sx = centerX + xMm * scale;
      const sy = centerY - yMm * scale;
      return [sx, sy];
    };

    // Draw Bed Surface (Paper/Aluminum base) - Perfect Square
    ctx.save();
    ctx.fillStyle = '#0a0a0c';
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1;
    ctx.fillRect(offsetX, offsetY, bedPixelW, bedPixelH);
    ctx.strokeRect(offsetX, offsetY, bedPixelW, bedPixelH);

    // Bed Grid lines every 10mm (Minor grid centered around 0,0)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 0.5;

    for (let x = -halfW + 10; x < halfW; x += 10) {
      const [sx] = mmToScreen(x, 0);
      ctx.moveTo(sx, offsetY);
      ctx.lineTo(sx, offsetY + bedPixelH);
    }
    for (let y = -halfH + 10; y < halfH; y += 10) {
      const [, sy] = mmToScreen(0, y);
      ctx.moveTo(offsetX, sy);
      ctx.lineTo(offsetX + bedPixelW, sy);
    }
    ctx.stroke();

    // 50mm major grid with ruler labels (from -half to +half)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#737373';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let x = -halfW; x <= halfW; x += 50) {
      const [sx] = mmToScreen(x, 0);
      ctx.moveTo(sx, offsetY);
      ctx.lineTo(sx, offsetY + bedPixelH);
      ctx.fillText(`${x > 0 ? '+' : ''}${x}`, sx, offsetY + bedPixelH + 5);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = -halfH; y <= halfH; y += 50) {
      const [, sy] = mmToScreen(0, y);
      ctx.moveTo(offsetX, sy);
      ctx.lineTo(offsetX + bedPixelW, sy);
      ctx.fillText(`${y > 0 ? '+' : ''}${y}`, offsetX - 6, sy);
    }
    ctx.stroke();

    // Center Axes (X=0 and Y=0 intersecting in the middle)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1.2;
    // Horizontal X axis (Y=0)
    ctx.moveTo(offsetX, centerY);
    ctx.lineTo(offsetX + bedPixelW, centerY);
    // Vertical Y axis (X=0)
    ctx.moveTo(centerX, offsetY);
    ctx.lineTo(centerX, offsetY + bedPixelH);
    ctx.stroke();

    // Origin indicator [0, 0] in the exact center
    const [origX, origY] = mmToScreen(0, 0);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(origX, origY, 4, 0, Math.PI * 2);
    ctx.moveTo(origX - 16, origY);
    ctx.lineTo(origX + 16, origY);
    ctx.moveTo(origX, origY - 16);
    ctx.lineTo(origX, origY + 16);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('(0,0) Center Origin', origX + 8, origY - 8);

    // Calculate how many points to draw based on playbackProgress
    const targetPointCount = Math.floor(totalPoints * playbackProgress);
    let drawnPoints = 0;
    let lastPenPosition: [number, number] | null = [0, 0];

    // Draw Vector Paths
    for (let pIdx = 0; pIdx < paths.length; pIdx++) {
      const path = paths[pIdx];
      if (path.length < 2) continue;

      const pathStart = path[0];

      // Draw G0 Rapid Transit (Pen UP)
      if (showRapidMoves && lastPenPosition) {
        const [rStartX, rStartY] = mmToScreen(lastPenPosition[0], lastPenPosition[1]);
        const [rEndX, rEndY] = mmToScreen(pathStart[0], pathStart[1]);

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.moveTo(rStartX, rStartY);
        ctx.lineTo(rEndX, rEndY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw G1 Stroke (Pen DOWN)
      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1, penThicknessMm * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const [sx0, sy0] = mmToScreen(pathStart[0], pathStart[1]);
      ctx.moveTo(sx0, sy0);
      drawnPoints++;

      let pathTerminatedEarly = false;
      let lastPointOfStroke = pathStart;

      for (let i = 1; i < path.length; i++) {
        if (drawnPoints >= targetPointCount) {
          pathTerminatedEarly = true;
          break;
        }
        const pt = path[i];
        const [px, py] = mmToScreen(pt[0], pt[1]);
        ctx.lineTo(px, py);
        drawnPoints++;
        lastPointOfStroke = pt;
      }

      ctx.stroke();
      lastPenPosition = lastPointOfStroke;

      if (pathTerminatedEarly) break;
    }

    // Draw Toolhead cursor
    // If live CNC coordinates are available, use them, otherwise use last plotted point
    const toolCoord = liveCoordinates
      ? [liveCoordinates.x, liveCoordinates.y]
      : (lastPenPosition || [0, 0]);

    const isPenDown = liveCoordinates ? liveCoordinates.penDown : (playbackProgress > 0 && playbackProgress < 1);
    const [tx, ty] = mmToScreen(toolCoord[0], toolCoord[1]);

    // Outer ring
    ctx.beginPath();
    ctx.strokeStyle = isPenDown ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(tx - 12, ty);
    ctx.lineTo(tx + 12, ty);
    ctx.moveTo(tx, ty - 12);
    ctx.lineTo(tx, ty + 12);
    ctx.stroke();

    // Center pen tip dot
    ctx.beginPath();
    ctx.fillStyle = isPenDown ? '#ef4444' : '#f59e0b';
    ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [paths, machineConfig, playbackProgress, showRapidMoves, totalPoints, penThicknessMm, liveCoordinates]);

  // Export SVG handler
  const handleExportSvg = () => {
    const bedW = machineConfig.bedWidth;
    const bedH = machineConfig.bedHeight;

    const pathStrings = paths.map((path) => {
      if (path.length === 0) return '';
      const d = path
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${(bedH - p[1]).toFixed(2)}`)
        .join(' ');
      return `<path d="${d}" fill="none" stroke="#000000" stroke-width="${penThicknessMm}" stroke-linecap="round" stroke-linejoin="round" />`;
    });

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bedW} ${bedH}" width="${bedW}mm" height="${bedH}mm">
  <!-- PlotterCraft CNC Vector Export -->
  <rect width="${bedW}" height="${bedH}" fill="#ffffff" />
  <g id="plot_paths">
    ${pathStrings.join('\n    ')}
  </g>
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plotter_artwork.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg h-full">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/90 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-200">CNC Bed Visualizer</span>
          <span className="text-xs text-neutral-500 font-mono">
            {machineConfig.bedWidth}×{machineConfig.bedHeight} mm
          </span>
          <span className="text-neutral-600 font-mono text-xs">·</span>
          <span className="text-xs text-neutral-400 font-mono">
            {paths.length.toLocaleString()} paths
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowRapidMoves(!showRapidMoves)}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
              showRapidMoves ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
            title="Toggle G0 Rapid Pen-Up Transit lines"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">Rapid Moves</span>
          </button>

          <button
            onClick={onOptimizePaths}
            className="px-2.5 py-1 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 rounded transition-colors flex items-center gap-1"
            title="Greedy Nearest-Neighbor path reordering to minimize pen travel"
          >
            <Zap className="w-3 h-3" />
            <span>Optimize Travel</span>
          </button>

          <button
            onClick={onOpenGcodeModal}
            className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1"
          >
            <FileCode className="w-3 h-3" />
            <span className="hidden sm:inline">G-Code</span>
          </button>

          <button
            onClick={handleExportSvg}
            className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1"
            title="Download clean vector SVG"
          >
            <Download className="w-3 h-3" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div ref={containerRef} className="relative flex-1 min-h-[360px] bg-neutral-950">
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

        {/* Legend Overlay */}
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

        {/* Empty paths state */}
        {paths.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-neutral-950/80 backdrop-blur-xs">
            <Layers className="w-10 h-10 text-neutral-600 mb-2" />
            <p className="text-sm font-medium text-neutral-300">No Vector Paths Generated Yet</p>
            <p className="text-xs text-neutral-500 max-w-sm mt-1">
              Select a sample preset or upload an image on the left, then click &ldquo;Generate Paths &amp; G-Code&rdquo;.
            </p>
          </div>
        )}
      </div>

      {/* Scrubber & Simulation Bar */}
      <div className="px-4 py-2.5 border-t border-neutral-800 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={paths.length === 0}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors disabled:opacity-40"
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setPlaybackProgress(0);
            }}
            disabled={paths.length === 0}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-40"
            title="Reset to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed selector */}
          <div className="flex items-center bg-neutral-800/80 rounded p-0.5 text-[11px] font-mono text-neutral-300">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeedMultiplier(s)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  speedMultiplier === s ? 'bg-neutral-700 text-amber-400 font-semibold' : 'hover:text-neutral-100'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Scrubber Range */}
        <div className="flex-1 min-w-[150px] max-w-md flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={playbackProgress}
            onChange={(e) => {
              setIsPlaying(false);
              setPlaybackProgress(parseFloat(e.target.value));
            }}
            disabled={paths.length === 0}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
          />
          <span className="text-xs font-mono text-neutral-400 w-10 text-right tabular-nums">
            {Math.round(playbackProgress * 100)}%
          </span>
        </div>

        {/* Download Gcode button */}
        <button
          onClick={onDownloadGcode}
          disabled={!plotJob}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save G-Code</span>
        </button>
      </div>

      {/* Metrics Footer Bar with tabular figures */}
      {plotJob && (
        <div className="grid grid-cols-2 sm:grid-cols-4 px-4 py-2 border-t border-neutral-800/60 bg-neutral-950 text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-neutral-500 text-[10px] uppercase">Draw Distance</span>
            <span className="text-cyan-400 font-semibold tabular-nums">
              {(plotJob.totalDrawDistMm / 1000).toFixed(2)} m
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-neutral-500 text-[10px] uppercase">Rapid Transit</span>
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
            <span className="text-neutral-500 text-[10px] uppercase">Est. Print Time</span>
            <span className="text-emerald-400 font-semibold tabular-nums">
              ~{formatTime(plotJob.estimatedDurationSec)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
