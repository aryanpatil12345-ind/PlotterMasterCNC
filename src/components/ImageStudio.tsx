import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Sliders, RefreshCw, Wand2, ShieldAlert } from 'lucide-react';
import { ImageProcessingConfig, PaperSizePreset, AlgorithmType, MachineConfig } from '../types/plotter';
import { SAMPLE_PRESETS } from '../utils/sampleImages';
import {
  getPreprocessedImageData,
  generateContourPaths,
  generateCenterlinePaths,
  generateHatchingPaths,
  generateSpiralPaths,
  generateTSPPaths,
  scalePathsToBed,
  optimizePaths
} from '../utils/imageVectorizer';

interface ImageStudioProps {
  imageConfig: ImageProcessingConfig;
  setImageConfig: React.Dispatch<React.SetStateAction<ImageProcessingConfig>>;
  machineConfig: MachineConfig;
  onPathsGenerated: (paths: import('../types/plotter').Path[]) => void;
  onNavigateToGCodeStudio?: () => void;
  onNavigateToController?: () => void;
  onNavigateToGallery?: () => void;
  pathsCount?: number;
  externalImageSrc?: string | null;
  externalImageTitle?: string | null;
  onImageChange?: (src: string, title: string) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  imageConfig,
  setImageConfig,
  machineConfig,
  onPathsGenerated,
  onNavigateToGCodeStudio,
  onNavigateToController,
  onNavigateToGallery,
  pathsCount = 0,
  externalImageSrc,
  externalImageTitle,
  onImageChange,
}) => {
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastGeneratedCount, setLastGeneratedCount] = useState<number>(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('mechanical_gear');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);

  // Sync external image when chosen from Gallery
  useEffect(() => {
    if (externalImageSrc) {
      setCurrentImageSrc(externalImageSrc);
      if (externalImageTitle) {
        setUploadedFileName(externalImageTitle);
        onImageChange?.(externalImageSrc, externalImageTitle);
      }
    }
  }, [externalImageSrc, externalImageTitle, onImageChange]);

  // Load initial sample preset on mount
  useEffect(() => {
    const gearPreset = SAMPLE_PRESETS.find((p) => p.id === 'mechanical_gear');
    if (gearPreset) {
      const canvas = gearPreset.createImage();
      const url = canvas.toDataURL('image/png');
      setCurrentImageSrc(url);
      setUploadedFileName('Da Vinci Involute Gear');
      onImageChange?.(url, 'Da Vinci Involute Gear');
    }
  }, [onImageChange]);

  // Paper preset dimensions in mm
  const handlePaperPresetChange = (preset: PaperSizePreset) => {
    let w = 500;
    let h = 500;

    if (preset === 'Square500') {
      w = 500;
      h = 500;
    } else if (preset === 'A4') {
      w = 210;
      h = 297;
    } else if (preset === 'A3') {
      w = 297;
      h = 420;
    } else if (preset === 'Letter') {
      w = 216;
      h = 279;
    } else if (preset === 'Square150') {
      w = 150;
      h = 150;
    } else if (preset === 'Square300') {
      w = 300;
      h = 300;
    }

    setImageConfig((prev) => ({
      ...prev,
      paperSize: preset,
      customWidth: w,
      customHeight: h,
    }));
  };

  // Quality Level presets
  const handleQualityLevelChange = (level: 'potato' | 'low' | 'medium' | 'high') => {
    if (level === 'potato') {
      setImageConfig((prev) => ({
        ...prev,
        qualityLevel: 'potato',
        singleLineCenterline: prev.singleLineCenterline ?? true,
        shrinkRatio: prev.shrinkRatio || 0.60,
        detailLevel: 1,
        simplifyTolerance: 0.8,
        hatchingSpacing: 3.5,
      }));
    } else if (level === 'low') {
      setImageConfig((prev) => ({
        ...prev,
        qualityLevel: 'low',
        singleLineCenterline: prev.singleLineCenterline ?? true,
        shrinkRatio: prev.shrinkRatio || 0.65,
        detailLevel: 2,
        simplifyTolerance: 0.45,
        hatchingSpacing: 2.8,
      }));
    } else if (level === 'medium') {
      setImageConfig((prev) => ({
        ...prev,
        qualityLevel: 'medium',
        singleLineCenterline: prev.singleLineCenterline ?? true,
        shrinkRatio: prev.shrinkRatio || 0.70,
        detailLevel: 3,
        simplifyTolerance: 0.25,
        hatchingSpacing: 2.0,
      }));
    } else if (level === 'high') {
      setImageConfig((prev) => ({
        ...prev,
        qualityLevel: 'high',
        singleLineCenterline: false,
        shrinkRatio: 1.0,
        detailLevel: 5,
        simplifyTolerance: 0.1,
        hatchingSpacing: 1.2,
      }));
    }
  };

  // Run vectorization process
  const runVectorization = useCallback(() => {
    if (!currentImageSrc) return;
    setIsProcessing(true);
    setUploadError(null);

    const img = new Image();
    // Only set crossOrigin on remote HTTP images, NEVER on local data URLs
    if (currentImageSrc.startsWith('http://') || currentImageSrc.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    img.onerror = () => {
      setUploadError('Failed to decode image file. Please upload a standard PNG, JPEG, or SVG.');
      setIsProcessing(false);
    };

    img.onload = () => {
      try {
        imgElementRef.current = img;

        // Target processing dimensions (max 500px for speedy responsiveness)
        const maxDim = 400 * (imageConfig.detailLevel / 2);
        let targetW = img.naturalWidth || 400;
        let targetH = img.naturalHeight || 400;

        if (targetW > maxDim || targetH > maxDim) {
          const ratio = Math.min(maxDim / targetW, maxDim / targetH);
          targetW = Math.round(targetW * ratio);
          targetH = Math.round(targetH * ratio);
        }

        // Preprocess grayscale pixel buffer
        const { data, width, height } = getPreprocessedImageData(img, targetW, targetH, imageConfig);

        let rawPaths: import('../types/plotter').Path[] = [];

        // When Single-Line Centerline mode is enabled (for potato/low/medium), thick parts collapse into a single central skeleton line
        if (imageConfig.singleLineCenterline) {
          rawPaths = generateCenterlinePaths(data, width, height, imageConfig.threshold, imageConfig.simplifyTolerance);
          // If skeleton is empty, fall back gracefully to contour
          if (rawPaths.length === 0) {
            rawPaths = generateContourPaths(data, width, height, imageConfig.threshold, imageConfig.simplifyTolerance);
          }
        } else if (imageConfig.algorithm === 'contour') {
          rawPaths = generateContourPaths(data, width, height, imageConfig.threshold, imageConfig.simplifyTolerance);
          // If contour finds 0 paths (e.g. low-gradient photo), auto-fallback to hatching so user is never stuck
          if (rawPaths.length === 0) {
            rawPaths = generateHatchingPaths(data, width, height, imageConfig, false);
          }
        } else if (imageConfig.algorithm === 'hatching') {
          rawPaths = generateHatchingPaths(data, width, height, imageConfig, false);
        } else if (imageConfig.algorithm === 'crosshatch') {
          rawPaths = generateHatchingPaths(data, width, height, imageConfig, true);
        } else if (imageConfig.algorithm === 'spiral') {
          rawPaths = generateSpiralPaths(data, width, height, imageConfig);
        } else if (imageConfig.algorithm === 'tsp') {
          rawPaths = generateTSPPaths(data, width, height, imageConfig);
        }

        // Scale paths to machine bed mm (with shrunk ratio if single-line shrunk mode is active)
        const shrinkFactor = imageConfig.singleLineCenterline ? (imageConfig.shrinkRatio || 0.65) : 1.0;
        const scaled = scalePathsToBed(
          rawPaths,
          width,
          height,
          imageConfig.paperSize === 'Custom' ? imageConfig.customWidth : machineConfig.bedWidth,
          imageConfig.paperSize === 'Custom' ? imageConfig.customHeight : machineConfig.bedHeight,
          imageConfig.margin,
          true,
          shrinkFactor
        );

        // Optimize rapid travel order
        const optimized = optimizePaths(scaled);

        setLastGeneratedCount(optimized.length);
        onPathsGenerated(optimized);
      } catch (err: any) {
        console.error('Vectorization error:', err);
        setUploadError(`Vector conversion error: ${err.message || 'Unknown issue'}`);
      } finally {
        setIsProcessing(false);
      }
    };
    img.src = currentImageSrc;
  }, [currentImageSrc, imageConfig, machineConfig, onPathsGenerated]);

  // Trigger vectorization when image or config changes
  useEffect(() => {
    if (currentImageSrc) {
      runVectorization();
    }
  }, [
    currentImageSrc,
    imageConfig.algorithm,
    imageConfig.threshold,
    imageConfig.contrast,
    imageConfig.brightness,
    imageConfig.invert,
    imageConfig.simplifyTolerance,
    imageConfig.hatchingAngle,
    imageConfig.hatchingSpacing,
    imageConfig.spiralSpacing,
    imageConfig.tspMaxPoints,
    imageConfig.margin,
    imageConfig.singleLineCenterline,
    imageConfig.shrinkRatio,
    imageConfig.qualityLevel,
  ]);

  // Handle file drop & upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setUploadError(null);
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCurrentImageSrc(result);
        setSelectedPresetId('custom_upload');
        onImageChange?.(result, file.name);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file from disk.');
    };
    reader.readAsDataURL(file);
  };

  const selectPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setSelectedPresetId(preset.id);
    setUploadedFileName(preset.title);
    const canvas = preset.createImage();
    const url = canvas.toDataURL('image/png');
    setCurrentImageSrc(url);
    onImageChange?.(url, preset.title);
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* 1. Image Source & Presets Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-neutral-200">Image Input</h3>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToGallery && (
              <button
                type="button"
                onClick={onNavigateToGallery}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 font-medium text-[11px] transition-colors border border-amber-400/20"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>AI &amp; Gallery</span>
              </button>
            )}
            <span className="text-[11px] text-neutral-500 font-mono hidden sm:inline">PNG/SVG</span>
          </div>
        </div>

        {uploadError && (
          <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Drop Zone & Preview */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="relative group border border-dashed border-neutral-700 hover:border-amber-400/60 rounded-lg p-3 text-center cursor-pointer transition-colors bg-neutral-950/60 hover:bg-neutral-950/90 flex flex-col items-center justify-center min-h-[110px]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {currentImageSrc ? (
            <div className="flex items-center gap-3 w-full">
              <img
                src={currentImageSrc}
                alt="Source preview"
                className="w-16 h-16 object-contain bg-white rounded border border-neutral-800 p-1 shrink-0"
              />
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs font-semibold text-neutral-100 truncate">
                  {uploadedFileName || (selectedPresetId === 'custom_upload' ? 'Custom Uploaded Image' : 'Sample Preset')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ✓ Loaded ({lastGeneratedCount || pathsCount} paths)
                  </span>
                  <span className="text-[10px] text-neutral-400">Click to change</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-2">
              <Upload className="w-5 h-5 text-neutral-400 group-hover:text-amber-400 transition-colors" />
              <p className="text-xs font-medium text-neutral-300">Drop any image here or click to browse</p>
              <p className="text-[11px] text-neutral-400">Supports PNG, JPG, JPEG, SVG, WebP</p>
            </div>
          )}
        </div>

        {/* Direct Action Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={runVectorization}
            disabled={isProcessing || !currentImageSrc}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors shadow-sm disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Generating...' : 'Generate G-Code Now'}</span>
          </button>

          {onNavigateToGCodeStudio && (
            <button
              onClick={onNavigateToGCodeStudio}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg text-xs transition-colors"
              title="Open full G-Code Studio & Editor"
            >
              G-Code Studio &rarr;
            </button>
          )}

          {onNavigateToController && (
            <button
              onClick={onNavigateToController}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-medium rounded-lg text-xs transition-colors"
              title="Jump straight to CNC Controller"
            >
              Send to CNC &rarr;
            </button>
          )}
        </div>

        {/* Instant Presets */}
        <div className="mt-3">
          <p className="text-[11px] text-neutral-400 mb-2 font-medium">Quick Testing Presets:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => selectPreset(preset)}
                className={`px-2.5 py-1.5 text-left rounded-md border text-[11px] transition-all ${
                  selectedPresetId === preset.id
                    ? 'border-amber-500/80 bg-amber-500/10 text-amber-300 font-medium'
                    : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span className="block truncate">{preset.title}</span>
                <span className="text-[10px] text-neutral-500">{preset.category}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Vectorization Algorithm Selector */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-neutral-200">Plotting Style Algorithm</h3>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Vectorizing...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            {
              id: 'contour',
              title: 'Line Contour (Edge Tracing)',
              desc: 'Crisp outline vector paths from Canny/Sobel edges. Great for drawings & blueprints.',
            },
            {
              id: 'hatching',
              title: 'Parallel Line Hatching',
              desc: 'Parallel linear strokes with density based on darkness. Architectural style.',
            },
            {
              id: 'crosshatch',
              title: 'Cross-Hatching (Dense Shadows)',
              desc: 'Multi-directional intersecting lines for rich dark shadows and depth.',
            },
            {
              id: 'spiral',
              title: 'Spiral Wave (Single Continuous)',
              desc: 'Single unbroken Archimedean spiral modulated by image luminance.',
            },
            {
              id: 'tsp',
              title: 'TSP Stipple (Single-Stroke)',
              desc: 'Traveling Salesperson path visiting halftone dots. 0 or 1 pen lift!',
            },
          ].map((algo) => (
            <button
              key={algo.id}
              onClick={() => setImageConfig((prev) => ({ ...prev, algorithm: algo.id as AlgorithmType }))}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                imageConfig.algorithm === algo.id
                  ? 'border-amber-400 bg-amber-500/10 text-neutral-100 shadow-xs'
                  : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold text-xs ${imageConfig.algorithm === algo.id ? 'text-amber-400' : 'text-neutral-200'}`}>
                  {algo.title}
                </span>
                {imageConfig.algorithm === algo.id && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-snug">{algo.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Quality Level & Print Area */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm space-y-4">
        {/* Quality Levels */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-neutral-200">Quality Level</h3>
            </div>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
              Current: {imageConfig.qualityLevel || 'medium'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'potato', label: 'Potato', desc: '🥔 Fast Draft', points: 'Low pts' },
              { id: 'low', label: 'Low', desc: '⚡ Quick Test', points: 'Mid-low' },
              { id: 'medium', label: 'Medium', desc: '⚖️ Balanced', points: 'Detailed' },
              { id: 'high', label: 'High', desc: '💎 Masterpiece', points: 'Ultra-Fine' },
            ].map((lvl) => {
              const active = (imageConfig.qualityLevel || 'medium') === lvl.id;
              return (
                <button
                  key={lvl.id}
                  onClick={() => handleQualityLevelChange(lvl.id as any)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    active
                      ? 'border-amber-400 bg-amber-500/15 text-neutral-100 ring-1 ring-amber-400/40'
                      : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span className={`block text-xs font-bold ${active ? 'text-amber-300' : 'text-neutral-300'}`}>
                    {lvl.label}
                  </span>
                  <span className="block text-[10px] text-neutral-400 mt-0.5">{lvl.desc}</span>
                  <span className="block text-[9px] text-neutral-500 font-mono mt-0.5">{lvl.points}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggleable Feature: Single-Line Centerline Thinning & Shrunk Mode */}
        <div className="pt-2 border-t border-neutral-800/80">
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="text-base mt-0.5">✂️</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-neutral-100">
                      Single-Line Centerline & Shrunk Mode
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
                      Potato · Low · Medium
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug">
                    Thick parts collapse into a single center pen stroke (skeleton thinning) and the drawing is shrunk for fast, clean plotting.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() =>
                  setImageConfig((prev) => ({
                    ...prev,
                    singleLineCenterline: !prev.singleLineCenterline,
                    shrinkRatio: prev.shrinkRatio || 0.65,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  imageConfig.singleLineCenterline ? 'bg-amber-500' : 'bg-neutral-700'
                }`}
                title={imageConfig.singleLineCenterline ? 'Disable single-line & shrunk mode' : 'Enable single-line & shrunk mode'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    imageConfig.singleLineCenterline ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Shrunk scale control and status when active */}
            {imageConfig.singleLineCenterline ? (
              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-[11px] flex-wrap gap-2">
                <span className="text-neutral-400 flex items-center gap-1.5 text-[10px]">
                  <span>📐</span> Shrunk Scale Factor:
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '50% Compact', val: 0.5 },
                    { label: '65% Recommended', val: 0.65 },
                    { label: '75% Medium', val: 0.75 },
                  ].map((s) => {
                    const active = Math.abs((imageConfig.shrinkRatio || 0.65) - s.val) < 0.03;
                    return (
                      <button
                        key={s.val}
                        type="button"
                        onClick={() =>
                          setImageConfig((prev) => ({
                            ...prev,
                            shrinkRatio: s.val,
                          }))
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                          active
                            ? 'bg-amber-400/20 text-amber-300 border-amber-500/50 font-semibold shadow-xs'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-neutral-500 italic pt-1 border-t border-neutral-800/40">
                Mode is OFF: Standard boundary contours and 100% full bed scale are used.
              </p>
            )}
          </div>
        </div>

        {/* Print Bed Area */}
        <div className="pt-2 border-t border-neutral-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-200">Print Bed Area</span>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50">
              500 × 500 mm · (0,0) Center
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              { id: 'Square500', label: '500×500', sub: 'Square' },
              { id: 'Square300', label: '300×300', sub: 'Square' },
              { id: 'Square150', label: '150×150', sub: 'Square' },
              { id: 'A4', label: 'A4', sub: '210×297' },
              { id: 'A3', label: 'A3', sub: '297×420' },
              { id: 'Letter', label: 'Letter', sub: '216×279' },
            ].map((ps) => {
              const active = imageConfig.paperSize === ps.id;
              return (
                <button
                  key={ps.id}
                  onClick={() => handlePaperPresetChange(ps.id as any)}
                  className={`px-2 py-1.5 rounded border text-center transition-all ${
                    active
                      ? 'border-amber-400 bg-amber-500/15 text-amber-300 font-medium'
                      : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span className="block text-[11px] leading-tight font-semibold">{ps.label}</span>
                  <span className="block text-[9px] text-neutral-500 leading-tight">{ps.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Preprocessing & Algorithm Adjustments */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-neutral-200">Image & Path Parameters</h3>
          </div>
          <button
            onClick={() =>
              setImageConfig((prev) => ({
                ...prev,
                threshold: 120,
                contrast: 15,
                brightness: 0,
                simplifyTolerance: 0.35,
                hatchingSpacing: 2.2,
                hatchingAngle: 45,
                invert: false,
              }))
            }
            className="text-[11px] text-neutral-400 hover:text-amber-400 transition-colors"
          >
            Reset Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Threshold */}
          <div>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>Threshold / Edge Cutoff</span>
              <span className="font-mono text-neutral-200">{imageConfig.threshold}</span>
            </div>
            <input
              type="range"
              min="10"
              max="245"
              value={imageConfig.threshold}
              onChange={(e) => setImageConfig((prev) => ({ ...prev, threshold: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>Contrast Boost</span>
              <span className="font-mono text-neutral-200">{imageConfig.contrast}</span>
            </div>
            <input
              type="range"
              min="-80"
              max="80"
              value={imageConfig.contrast}
              onChange={(e) => setImageConfig((prev) => ({ ...prev, contrast: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Brightness */}
          <div>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>Brightness</span>
              <span className="font-mono text-neutral-200">{imageConfig.brightness}</span>
            </div>
            <input
              type="range"
              min="-80"
              max="80"
              value={imageConfig.brightness}
              onChange={(e) => setImageConfig((prev) => ({ ...prev, brightness: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Path Smoothing / Tolerance */}
          <div>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>Path Smoothing (RDP Tolerance)</span>
              <span className="font-mono text-neutral-200">{imageConfig.simplifyTolerance} mm</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.05"
              value={imageConfig.simplifyTolerance}
              onChange={(e) => setImageConfig((prev) => ({ ...prev, simplifyTolerance: parseFloat(e.target.value) }))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Hatching Angle (if hatching) */}
          {(imageConfig.algorithm === 'hatching' || imageConfig.algorithm === 'crosshatch') && (
            <>
              <div>
                <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                  <span>Hatching Angle</span>
                  <span className="font-mono text-neutral-200">{imageConfig.hatchingAngle}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  value={imageConfig.hatchingAngle}
                  onChange={(e) => setImageConfig((prev) => ({ ...prev, hatchingAngle: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                  <span>Line Spacing</span>
                  <span className="font-mono text-neutral-200">{imageConfig.hatchingSpacing} mm</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="6"
                  step="0.2"
                  value={imageConfig.hatchingSpacing}
                  onChange={(e) => setImageConfig((prev) => ({ ...prev, hatchingSpacing: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </>
          )}

          {/* Spiral spacing */}
          {imageConfig.algorithm === 'spiral' && (
            <div>
              <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                <span>Spiral Coil Spacing</span>
                <span className="font-mono text-neutral-200">{imageConfig.spiralSpacing} mm</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="5.0"
                step="0.2"
                value={imageConfig.spiralSpacing}
                onChange={(e) => setImageConfig((prev) => ({ ...prev, spiralSpacing: parseFloat(e.target.value) }))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          )}

          {/* TSP Max Points */}
          {imageConfig.algorithm === 'tsp' && (
            <div>
              <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                <span>TSP Dot Density</span>
                <span className="font-mono text-neutral-200">{imageConfig.tspMaxPoints} pts</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                value={imageConfig.tspMaxPoints}
                onChange={(e) => setImageConfig((prev) => ({ ...prev, tspMaxPoints: parseInt(e.target.value) }))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          )}

          {/* Invert toggle & Bed Margin */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300">
              <input
                type="checkbox"
                checked={imageConfig.invert}
                onChange={(e) => setImageConfig((prev) => ({ ...prev, invert: e.target.checked }))}
                className="rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <span className="text-[11px]">Invert Colors (Dark/Light)</span>
            </label>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>Bed Safety Margin</span>
              <span className="font-mono text-neutral-200">{imageConfig.margin} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={imageConfig.margin}
              onChange={(e) => setImageConfig((prev) => ({ ...prev, margin: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
