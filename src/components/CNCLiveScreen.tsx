import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Crosshair,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Layers,
  Compass,
  Sliders,
  PenTool,
  Image as ImageIcon,
  CheckCircle2,
  RotateCcw,
  Move
} from 'lucide-react';
import { Path, MachineConfig, PlotJob, SerialState } from '../types/plotter';

interface CNCLiveScreenProps {
  paths: Path[];
  plotJob: PlotJob | null;
  machineConfig: MachineConfig;
  serialState: SerialState;
  imageSrc?: string | null;
  imageTitle?: string | null;
  penThicknessMm?: number;
  onNavigateToVectorizer?: () => void;
  onNavigateToGallery?: () => void;
  onJog?: (axis: 'X' | 'Y', direction: 1 | -1) => void;
}

export const CNCLiveScreen: React.FC<CNCLiveScreenProps> = ({
  paths,
  plotJob,
  machineConfig,
  serialState,
  imageSrc,
  imageTitle,
  penThicknessMm = 0.5,
  onNavigateToVectorizer,
  onNavigateToGallery,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Pan and zoom states
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // View features
  const [showImageBackdrop, setShowImageBackdrop] = useState<boolean>(true);
  const [imageOpacity, setImageOpacity] = useState<number>(0.45);
  const [imageStyle, setImageStyle] = useState<'natural' | 'blueprint' | 'grayscale'>('blueprint');
  const [showRapidMoves, setShowRapidMoves] = useState<boolean>(true);
  const [followPen, setFollowPen] = useState<boolean>(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState<boolean>(false);
  const [showPipBadge, setShowPipBadge] = useState<boolean>(true);

  // Preload and cache background image
  useEffect(() => {
    if (!imageSrc) {
      imageElementRef.current = null;
      return;
    }
    const img = new Image();
    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      imageElementRef.current = img;
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Total points for progress mapping
  const totalPoints = useMemo(() => {
    return paths.reduce((acc, p) => acc + p.length, 0);
  }, [paths]);

  // Fit bed to canvas viewport
  const handleFitBed = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setFollowPen(false);
  }, []);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.25, 6));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev * 0.8, 0.4));
  };

  // Canvas Mouse Pan & Zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Math.max(0.4, Math.min(prev * factor, 6)));
  };

  // Follow pen updater
  useEffect(() => {
    if (!followPen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const bedW = machineConfig.bedWidth;
    const bedH = machineConfig.bedHeight;
    const padding = 36;
    const availW = w - padding * 2;
    const availH = h - padding * 2;
    const baseScale = Math.min(availW / bedW, availH / bedH);

    const liveX = serialState.currentCoordinates.x;
    const liveY = serialState.currentCoordinates.y;

    const baseCenterX = padding + (availW - bedW * baseScale) / 2 + (bedW * baseScale) / 2;
    const baseCenterY = padding + (availH - bedH * baseScale) / 2 + (bedH * baseScale) / 2;
    const basePenX = baseCenterX + liveX * baseScale;
    const basePenY = baseCenterY - liveY * baseScale;

    // Pan so pen stays centered in viewport
    const targetPanX = w / 2 - basePenX * zoom;
    const targetPanY = h / 2 - basePenY * zoom;

    setPanOffset((prev) => ({
      x: prev.x + (targetPanX - prev.x) * 0.25,
      y: prev.y + (targetPanY - prev.y) * 0.25,
    }));
  }, [
    followPen,
    serialState.currentCoordinates.x,
    serialState.currentCoordinates.y,
    zoom,
    machineConfig.bedWidth,
    machineConfig.bedHeight,
  ]);

  // Main Canvas Render Loop
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

    // Dark sleek CNC screen background
    ctx.fillStyle = '#0c0d11';
    ctx.fillRect(0, 0, w, h);

    // Compute base scale and origin centering
    const padding = 36;
    const availW = w - padding * 2;
    const availH = h - padding * 2;
    const baseScale = Math.min(availW / bedW, availH / bedH);

    const bedPixelW = bedW * baseScale;
    const bedPixelH = bedH * baseScale;

    const baseOffsetX = padding + (availW - bedPixelW) / 2;
    const baseOffsetY = padding + (availH - bedPixelH) / 2;
    const baseCenterX = baseOffsetX + bedPixelW / 2;
    const baseCenterY = baseOffsetY + bedPixelH / 2;

    const halfW = bedW / 2;
    const halfH = bedH / 2;

    // Apply zoom & pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);

    // Origin [0, 0] in screen coords: 0, 0 is right in the middle!
    const mmToScreen = (xMm: number, yMm: number): [number, number] => {
      const sx = (baseCenterX + xMm * baseScale) * zoom;
      const sy = (baseCenterY - yMm * baseScale) * zoom;
      return [sx, sy];
    };

    const bedScreenX = baseOffsetX * zoom;
    const bedScreenY = baseOffsetY * zoom;
    const bedScreenW = bedPixelW * zoom;
    const bedScreenH = bedPixelH * zoom;

    // 1. Draw Bed Surface (Paper / Aluminum Work Area)
    ctx.fillStyle = '#07080a';
    ctx.strokeStyle = '#26262b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(bedScreenX, bedScreenY, bedScreenW, bedScreenH);
    ctx.strokeRect(bedScreenX, bedScreenY, bedScreenW, bedScreenH);

    // Bed corner alignment brackets
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    const bracketSize = Math.max(10, 14 * zoom);
    // Top-left
    ctx.beginPath();
    ctx.moveTo(bedScreenX, bedScreenY + bracketSize);
    ctx.lineTo(bedScreenX, bedScreenY);
    ctx.lineTo(bedScreenX + bracketSize, bedScreenY);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(bedScreenX + bedScreenW - bracketSize, bedScreenY);
    ctx.lineTo(bedScreenX + bedScreenW, bedScreenY);
    ctx.lineTo(bedScreenX + bedScreenW, bedScreenY + bracketSize);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bedScreenX, bedScreenY + bedScreenH - bracketSize);
    ctx.lineTo(bedScreenX, bedScreenY + bedScreenH);
    ctx.lineTo(bedScreenX + bracketSize, bedScreenY + bedScreenH);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(bedScreenX + bedScreenW - bracketSize, bedScreenY + bedScreenH);
    ctx.lineTo(bedScreenX + bedScreenW, bedScreenY + bedScreenH);
    ctx.lineTo(bedScreenX + bedScreenW, bedScreenY + bedScreenH - bracketSize);
    ctx.stroke();

    // 2. Minor Grid lines (every 10mm from -half to +half)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 0.5;

    for (let x = -halfW + 10; x < halfW; x += 10) {
      const [sx] = mmToScreen(x, 0);
      ctx.moveTo(sx, bedScreenY);
      ctx.lineTo(sx, bedScreenY + bedScreenH);
    }
    for (let y = -halfH + 10; y < halfH; y += 10) {
      const [, sy] = mmToScreen(0, y);
      ctx.moveTo(bedScreenX, sy);
      ctx.lineTo(bedScreenX + bedScreenW, sy);
    }
    ctx.stroke();

    // 3. Major Grid lines (every 50mm) + Ruler labels (-half to +half)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#71717a';
    ctx.font = `${Math.max(9, Math.round(10 * Math.min(zoom, 1.2)))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let x = -halfW; x <= halfW; x += 50) {
      const [sx] = mmToScreen(x, 0);
      ctx.moveTo(sx, bedScreenY);
      ctx.lineTo(sx, bedScreenY + bedScreenH);
      ctx.fillText(`${x > 0 ? '+' : ''}${x}`, sx, bedScreenY + bedScreenH + 6);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = -halfH; y <= halfH; y += 50) {
      const [, sy] = mmToScreen(0, y);
      ctx.moveTo(bedScreenX, sy);
      ctx.lineTo(bedScreenX + bedScreenW, sy);
      ctx.fillText(`${y > 0 ? '+' : ''}${y}`, bedScreenX - 7, sy);
    }
    ctx.stroke();

    // 4. Center Axis Lines (X=0 & Y=0 intersecting in the middle)
    const [origX, origY] = mmToScreen(0, 0);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.2;
    // Horizontal axis line
    ctx.moveTo(bedScreenX, origY);
    ctx.lineTo(bedScreenX + bedScreenW, origY);
    // Vertical axis line
    ctx.moveTo(origX, bedScreenY);
    ctx.lineTo(origX, bedScreenY + bedScreenH);
    ctx.stroke();

    // Origin indicator [0, 0] at center
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(origX, origY, 4, 0, Math.PI * 2);
    ctx.moveTo(origX - 16 * Math.min(zoom, 1.3), origY);
    ctx.lineTo(origX + 16 * Math.min(zoom, 1.3), origY);
    ctx.moveTo(origX, origY - 16 * Math.min(zoom, 1.3));
    ctx.lineTo(origX, origY + 16 * Math.min(zoom, 1.3));
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('0,0 (Center Origin)', origX + 7, origY - 7);

    // 5. DRAW THE IMAGE BEING PRINTED (Aligned backdrop)
    if (showImageBackdrop && imageElementRef.current && imageElementRef.current.complete) {
      const img = imageElementRef.current;
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(imageOpacity, 1));

      // Calculate placement: Align with plotJob bounds or centered within 500x500 bed
      let imgX = - (bedW - 30) / 2;
      let imgY = - (bedH - 30) / 2;
      let imgW = bedW - 30;
      let imgH = bedH - 30;

      if (plotJob && plotJob.bounds && plotJob.bounds.width > 0 && plotJob.bounds.height > 0) {
        imgX = plotJob.bounds.minX;
        imgY = plotJob.bounds.minY;
        imgW = plotJob.bounds.width;
        imgH = plotJob.bounds.height;
      }

      // Convert mm bounds (top-left is [imgX, imgY + imgH]) to screen coordinates
      const [imgSx0, imgSyTop] = mmToScreen(imgX, imgY + imgH);
      const imgPixelW = imgW * baseScale * zoom;
      const imgPixelH = imgH * baseScale * zoom;

      // Apply style filter
      if (imageStyle === 'blueprint') {
        // Subtle blueprint cyan overlay
        ctx.drawImage(img, imgSx0, imgSyTop, imgPixelW, imgPixelH);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillRect(imgSx0, imgSyTop, imgPixelW, imgPixelH);
        ctx.globalCompositeOperation = 'source-over';
      } else if (imageStyle === 'grayscale') {
        ctx.drawImage(img, imgSx0, imgSyTop, imgPixelW, imgPixelH);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillRect(imgSx0, imgSyTop, imgPixelW, imgPixelH);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.drawImage(img, imgSx0, imgSyTop, imgPixelW, imgPixelH);
      }

      // Border outline around the image area
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(imgSx0, imgSyTop, imgPixelW, imgPixelH);
      ctx.setLineDash([]);

      ctx.restore();
    }

    // 6. DRAW VECTOR PATHS (What is being printed)
    const isStreaming = serialState.status === 'streaming';
    const hasProgress = serialState.currentLineIndex > 0 && serialState.totalLines > 0;
    const progressRatio = hasProgress ? serialState.currentLineIndex / serialState.totalLines : 0;
    const targetPointCount = isStreaming || hasProgress
      ? Math.floor(totalPoints * progressRatio)
      : totalPoints;

    let drawnPoints = 0;
    let lastPointOfPlot: [number, number] | null = [0, 0];

    for (let pIdx = 0; pIdx < paths.length; pIdx++) {
      const path = paths[pIdx];
      if (path.length < 2) continue;

      const pathStart = path[0];

      // Draw G0 Rapid Transit Move (Pen UP travel)
      if (showRapidMoves && lastPointOfPlot) {
        const [rStartX, rStartY] = mmToScreen(lastPointOfPlot[0], lastPointOfPlot[1]);
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

      // Check how much of this path is already drawn vs pending
      const pathPointsCount = path.length;
      const isPathFullyDrawn = drawnPoints + pathPointsCount <= targetPointCount;
      const isPathPending = drawnPoints >= targetPointCount;

      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isStreaming || hasProgress) {
        if (isPathFullyDrawn) {
          // Completed stroke: bright vibrant cyan
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = Math.max(1.2, penThicknessMm * baseScale * zoom);
        } else if (isPathPending) {
          // Future stroke: faint translucent blueprint line
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
          ctx.lineWidth = Math.max(0.8, (penThicknessMm * 0.7) * baseScale * zoom);
        } else {
          // Current stroke in progress: illuminated cyan
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = Math.max(1.5, penThicknessMm * 1.2 * baseScale * zoom);
        }
      } else {
        // Idle view: clean blueprint cyan
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(1.2, penThicknessMm * baseScale * zoom);
      }

      const [sx0, sy0] = mmToScreen(pathStart[0], pathStart[1]);
      ctx.moveTo(sx0, sy0);
      drawnPoints++;

      let lastPt = pathStart;
      for (let i = 1; i < path.length; i++) {
        const pt = path[i];
        const [px, py] = mmToScreen(pt[0], pt[1]);
        ctx.lineTo(px, py);
        drawnPoints++;
        lastPt = pt;
      }
      ctx.stroke();
      lastPointOfPlot = lastPt;
    }

    // 7. WHERE THE PEN IS (Live CNC Toolhead Indicator)
    const liveX = serialState.currentCoordinates.x;
    const liveY = serialState.currentCoordinates.y;
    const isPenDown = serialState.currentCoordinates.penDown;
    const [toolX, toolY] = mmToScreen(liveX, liveY);

    // Animated glow halo around toolhead
    ctx.save();
    if (isPenDown) {
      // PEN DOWN: Glowing Red / Crimson contact laser spot
      const glow = ctx.createRadialGradient(toolX, toolY, 2, toolX, toolY, 20);
      glow.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
      glow.addColorStop(0.5, 'rgba(239, 68, 68, 0.25)');
      glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(toolX, toolY, 20, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toolX, toolY, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Center pen contact dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(toolX, toolY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // PEN UP: High-visibility Amber Transit Cursor
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(toolX, toolY, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Dashed outer targeting ring
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(toolX, toolY, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center dot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(toolX, toolY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crosshairs (+ extending 15px)
    ctx.strokeStyle = isPenDown ? 'rgba(239, 68, 68, 0.7)' : 'rgba(245, 158, 11, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toolX - 16, toolY);
    ctx.lineTo(toolX + 16, toolY);
    ctx.moveTo(toolX, toolY - 16);
    ctx.lineTo(toolX, toolY + 16);
    ctx.stroke();

    // Floating Pen Tooltip Tag
    ctx.font = '10px "JetBrains Mono", monospace';
    const tagText = `${isPenDown ? '● PEN DOWN' : '○ PEN UP'} [${liveX.toFixed(1)}, ${liveY.toFixed(1)}]`;
    const tagMetrics = ctx.measureText(tagText);
    const tagW = tagMetrics.width + 12;
    const tagH = 18;
    const tagX = toolX + 14;
    const tagY = toolY - 24;

    ctx.fillStyle = 'rgba(10, 10, 14, 0.88)';
    ctx.strokeStyle = isPenDown ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isPenDown ? '#fca5a5' : '#fde047';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, tagX + 6, tagY + tagH / 2);

    ctx.restore();
    ctx.restore();
  }, [
    paths,
    machineConfig.bedWidth,
    machineConfig.bedHeight,
    serialState.currentCoordinates.x,
    serialState.currentCoordinates.y,
    serialState.currentCoordinates.penDown,
    serialState.currentLineIndex,
    serialState.totalLines,
    serialState.status,
    totalPoints,
    penThicknessMm,
    zoom,
    panOffset,
    showImageBackdrop,
    imageOpacity,
    imageStyle,
    showRapidMoves,
    plotJob,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm h-full select-none"
    >
      {/* Screen Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 bg-neutral-900/95 border-b border-neutral-800 z-10 gap-2">
        {/* Left: Title & Status Indicator */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-xs text-neutral-100">Live CNC Bed Screen</span>
          </div>

          {/* Machine State Pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-950 border border-neutral-800 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                serialState.status === 'streaming'
                  ? 'bg-emerald-500 animate-pulse'
                  : serialState.status === 'paused'
                  ? 'bg-amber-400'
                  : serialState.status === 'connected'
                  ? 'bg-cyan-400'
                  : 'bg-neutral-600'
              }`}
            />
            <span className="text-neutral-300 font-medium">
              {serialState.status === 'streaming'
                ? 'Plotted: ' + serialState.progressPercent + '%'
                : serialState.status === 'paused'
                ? 'Paused'
                : serialState.status === 'connected'
                ? serialState.isVirtual
                  ? 'Simulator Ready'
                  : 'Ready'
                : 'Plotter Offline'}
            </span>
          </div>

          {/* Live Toolhead Coordinate Readout */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 bg-neutral-950/80 px-2 py-0.5 rounded border border-neutral-800/80">
            <span className="text-cyan-400">X:{serialState.currentCoordinates.x.toFixed(1)}</span>
            <span className="text-cyan-400">Y:{serialState.currentCoordinates.y.toFixed(1)}</span>
            <span
              className={`font-semibold ${
                serialState.currentCoordinates.penDown ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {serialState.currentCoordinates.penDown ? 'PEN DOWN' : 'PEN UP'}
            </span>
          </div>
        </div>

        {/* Right: Screen Controls & Display Toggles */}
        <div className="flex items-center gap-1.5">
          {/* Follow Pen Toggle */}
          <button
            onClick={() => setFollowPen((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
              followPen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border-neutral-800'
            }`}
            title="Auto-center canvas on toolhead pen position"
          >
            <Move className="w-3 h-3" />
            <span className="hidden md:inline">Follow Pen</span>
          </button>

          {/* Image Backdrop Toggle Button */}
          {imageSrc && (
            <button
              onClick={() => setShowImageBackdrop((prev) => !prev)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
                showImageBackdrop
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border-neutral-800'
              }`}
              title="Toggle artwork image backdrop"
            >
              <ImageIcon className="w-3 h-3" />
              <span className="hidden md:inline">Image</span>
              {showImageBackdrop ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
          )}

          {/* Image Display Adjuster Popover Toggle */}
          {imageSrc && showImageBackdrop && (
            <div className="relative">
              <button
                onClick={() => setShowSettingsPopover((prev) => !prev)}
                className={`p-1 rounded text-neutral-400 hover:text-neutral-200 bg-neutral-950 border border-neutral-800 transition-colors ${
                  showSettingsPopover ? 'text-amber-400 border-amber-500/40' : ''
                }`}
                title="Adjust image opacity & style"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>

              {showSettingsPopover && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-neutral-900 border border-neutral-700/80 rounded-lg p-3 shadow-xl z-30 text-xs space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                    <span className="font-semibold text-neutral-200 text-[11px]">Image Backdrop Settings</span>
                    <button
                      onClick={() => setShowSettingsPopover(false)}
                      className="text-neutral-400 hover:text-neutral-200 text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Opacity Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                      <span>Opacity</span>
                      <span className="text-amber-400">{Math.round(imageOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={imageOpacity}
                      onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-950 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Style Mode */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-neutral-400">Backdrop Style</span>
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-medium">
                      {(['blueprint', 'natural', 'grayscale'] as const).map((style) => (
                        <button
                          key={style}
                          onClick={() => setImageStyle(style)}
                          className={`py-1 rounded border capitalize transition-colors ${
                            imageStyle === style
                              ? 'bg-neutral-800 text-amber-400 border-amber-500/40'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rapid Moves Toggle */}
          <button
            onClick={() => setShowRapidMoves((prev) => !prev)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors border ${
              showRapidMoves
                ? 'bg-neutral-800 text-amber-400 border-neutral-700'
                : 'bg-neutral-950 text-neutral-500 border-neutral-800'
            }`}
            title="Toggle G0 Rapid Travel dashed lines"
          >
            G0 Rapid
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitBed}
              className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Fit Bed [Reset View]"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="relative flex-1 w-full min-h-[360px] cursor-grab active:cursor-grabbing overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full block"
        />

        {/* Floating Picture-in-Picture: Artwork Card */}
        {showPipBadge && (
          <div className="absolute bottom-3 left-3 bg-neutral-950/90 backdrop-blur-md border border-neutral-800/90 rounded-lg p-2.5 shadow-xl max-w-xs z-10">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-800/80 mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-neutral-200">Printing Image</span>
              </div>
              <button
                onClick={() => setShowPipBadge(false)}
                className="text-neutral-500 hover:text-neutral-300 text-[10px]"
                title="Hide preview badge"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Thumbnail */}
              {imageSrc ? (
                <div className="w-12 h-12 rounded border border-neutral-700 bg-neutral-900 overflow-hidden shrink-0">
                  <img
                    src={imageSrc}
                    alt="Print Artwork"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded border border-neutral-800 bg-neutral-900 flex items-center justify-center text-neutral-600 shrink-0">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-neutral-100 truncate" title={imageTitle || 'Active Job'}>
                  {imageTitle || (plotJob ? 'Vector Job' : 'No Image Loaded')}
                </p>
                <div className="text-[10px] text-neutral-400 font-mono space-y-0.5 mt-0.5">
                  <p>
                    Area: {machineConfig.bedWidth} × {machineConfig.bedHeight} mm
                  </p>
                  <p>
                    {paths.length} paths · {plotJob ? (plotJob.totalDrawDistMm / 1000).toFixed(2) + 'm' : '0m'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-neutral-800/80">
              {onNavigateToVectorizer && (
                <button
                  onClick={onNavigateToVectorizer}
                  className="flex-1 py-1 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] font-medium text-center transition-colors"
                >
                  Tune Vectorizer
                </button>
              )}
              {onNavigateToGallery && (
                <button
                  onClick={onNavigateToGallery}
                  className="flex-1 py-1 px-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 rounded text-[10px] font-medium text-center transition-colors border border-amber-400/20"
                >
                  Browse Gallery
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Mini Bed Navigator / Re-open badge */}
        {!showPipBadge && (
          <button
            onClick={() => setShowPipBadge(true)}
            className="absolute bottom-3 left-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5 shadow-md"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Show Image Card</span>
          </button>
        )}

        {/* Live Pen Status Watermark in Bottom-Right */}
        <div className="absolute bottom-3 right-3 bg-neutral-950/85 backdrop-blur-md border border-neutral-800/90 rounded-lg px-3 py-1.5 font-mono text-[11px] shadow-lg flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              serialState.currentCoordinates.penDown
                ? 'bg-rose-500 animate-pulse'
                : 'bg-amber-400'
            }`}
          />
          <div className="flex items-center gap-1.5 text-neutral-300">
            <span className="font-semibold">
              {serialState.currentCoordinates.penDown ? 'DRAWING' : 'RAPID MOVE'}
            </span>
            <span className="text-neutral-500">|</span>
            <span className="text-cyan-400">
              X:{serialState.currentCoordinates.x.toFixed(1)} Y:{serialState.currentCoordinates.y.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
