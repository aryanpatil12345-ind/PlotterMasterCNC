import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Header, AppTab } from './components/Header';
import { ImageStudio } from './components/ImageStudio';
import { PlotterVisualizer } from './components/PlotterVisualizer';
import { CNCController } from './components/CNCController';
import { GcodeStudio } from './components/GcodeStudio';
import { FirmwareGuide } from './components/FirmwareGuide';
import { GcodeViewerModal } from './components/GcodeViewerModal';
import { PrintGalleryPage } from './components/PrintGalleryPage';
import { HelpPage } from './components/HelpPage';
import {
  ImageProcessingConfig,
  MachineConfig,
  Path,
  PlotJob,
  SerialState,
  LogEntry
} from './types/plotter';
import { generateGCode } from './utils/gcodeGenerator';
import {
  optimizePaths,
  getPreprocessedImageData,
  generateContourPaths,
  generateCenterlinePaths,
  scalePathsToBed
} from './utils/imageVectorizer';
import { WebSerialManager } from './utils/webSerial';
import { ArrowRight, Play, Cpu, Layers, Sparkles, Code } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('vectorizer');

  // Machine configuration (Default: 500x500 mm square bed, Dual-Y on CNC Shield V3 + SG90 Servo on Pin 11)
  const [machineConfig, setMachineConfig] = useState<MachineConfig>({
    kinematics: 'dual_y',
    bedWidth: 500, // 500x500 mm perfect square with (0,0) in the middle
    bedHeight: 500,
    stepsPerMmX: 80.0,
    stepsPerMmY: 80.0,
    feedrateRapid: 3000,
    feedrateDraw: 1500,
    penServoPin: 11,
    penUpAngle: 35,
    penDownAngle: 95,
    penLiftDelayMs: 150,
    invertX: false,
    invertY: false,
    invertY2: false,
    xStepPin: 2,
    xDirPin: 5,
    yStepPin: 3,
    yDirPin: 6,
    y2StepPin: 12,
    y2DirPin: 13,
    enablePin: 8,
    baudRate: 115200,
  });

  // Image vectorizer configuration (Default: 500x500 mm Square Bed with 0,0 in middle)
  const [imageConfig, setImageConfig] = useState<ImageProcessingConfig>({
    brightness: 0,
    contrast: 15,
    invert: false,
    threshold: 120,
    algorithm: 'contour',
    qualityLevel: 'medium',
    singleLineCenterline: true,
    shrinkRatio: 0.65,
    detailLevel: 3,
    simplifyTolerance: 0.25,
    hatchingAngle: 45,
    hatchingSpacing: 2.0,
    spiralSpacing: 2.0,
    tspMaxPoints: 800,
    paperSize: 'Square500',
    customWidth: 500,
    customHeight: 500,
    margin: 15,
    penThicknessMm: 0.5,
  });

  // Plot data
  const [paths, setPaths] = useState<Path[]>([]);
  const [plotJob, setPlotJob] = useState<PlotJob | null>(null);
  const [isGcodeModalOpen, setIsGcodeModalOpen] = useState(false);
  const [externalImageSrc, setExternalImageSrc] = useState<string | null>(null);
  const [externalImageTitle, setExternalImageTitle] = useState<string | null>(null);

  // Serial communication
  const [serialState, setSerialState] = useState<SerialState>({
    status: 'disconnected',
    portName: 'Not Connected',
    baudRate: 115200,
    isVirtual: false,
    progressPercent: 0,
    currentLineIndex: 0,
    totalLines: 0,
    currentCoordinates: { x: 0, y: 0, penDown: false },
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const serialManagerRef = useRef<WebSerialManager | null>(null);

  // Initialize WebSerialManager
  useEffect(() => {
    const manager = new WebSerialManager(
      (newState) => setSerialState(newState),
      (newLog) => setLogs((prev) => [...prev.slice(-300), newLog])
    );
    serialManagerRef.current = manager;

    return () => {
      manager.disconnect();
    };
  }, []);

  // Update G-code when paths or machine settings change
  const updatePlotJobWithPaths = useCallback(
    (newPaths: Path[]) => {
      setPaths(newPaths);
      if (newPaths.length > 0) {
        const job = generateGCode(newPaths, machineConfig);
        setPlotJob(job);
      } else {
        setPlotJob(null);
      }
    },
    [machineConfig]
  );

  // Optimize rapid travel order
  const handleOptimizePaths = () => {
    if (paths.length <= 1) return;
    const optimized = optimizePaths(paths);
    updatePlotJobWithPaths(optimized);
  };

  // Download G-code helper
  const handleDownloadGcode = () => {
    if (!plotJob) return;
    const blob = new Blob([plotJob.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plot_${machineConfig.bedWidth}x${machineConfig.bedHeight}mm.gcode`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Instant 1-click conversion from Gallery image to Plotter G-Code
  const handleSelectImageForPlot = useCallback(
    (imageUrl: string, title: string, directToController: boolean = false) => {
      setExternalImageSrc(imageUrl);
      setExternalImageTitle(title);

      const img = new Image();
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const maxDim = 400;
          let targetW = img.naturalWidth || 400;
          let targetH = img.naturalHeight || 400;
          if (targetW > maxDim || targetH > maxDim) {
            const ratio = Math.min(maxDim / targetW, maxDim / targetH);
            targetW = Math.round(targetW * ratio);
            targetH = Math.round(targetH * ratio);
          }
          const { data, width, height } = getPreprocessedImageData(img, targetW, targetH, imageConfig);
          const rawPaths = imageConfig.singleLineCenterline
            ? generateCenterlinePaths(data, width, height, imageConfig.threshold, imageConfig.simplifyTolerance)
            : generateContourPaths(data, width, height, imageConfig.threshold, imageConfig.simplifyTolerance);

          const shrinkFactor = imageConfig.singleLineCenterline ? (imageConfig.shrinkRatio || 0.65) : 1.0;
          const scaled = scalePathsToBed(
            rawPaths.length > 0 ? rawPaths : generateContourPaths(data, width, height, imageConfig.threshold, imageConfig.simplifyTolerance),
            width,
            height,
            machineConfig.bedWidth,
            machineConfig.bedHeight,
            imageConfig.margin,
            true,
            shrinkFactor
          );
          const optimized = optimizePaths(scaled);
          updatePlotJobWithPaths(optimized);

          if (directToController) {
            setActiveTab('controller');
          } else {
            setActiveTab('gcode');
          }
        } catch (err) {
          console.error('Error auto-tracing image from gallery:', err);
          setActiveTab('vectorizer');
        }
      };

      img.onerror = () => {
        setActiveTab('vectorizer');
      };

      img.src = imageUrl;
    },
    [imageConfig, machineConfig, updatePlotJobWithPaths]
  );

  const handleOpenVectorizerWithImage = (imageUrl: string, title: string) => {
    setExternalImageSrc(imageUrl);
    setExternalImageTitle(title);
    setActiveTab('vectorizer');
  };

  // Connect serial real
  const handleConnectSerial = async () => {
    if (!serialManagerRef.current) return;
    await serialManagerRef.current.connect(machineConfig.baudRate, false);
  };

  // Simulate serial
  const handleSimulateSerial = async () => {
    if (!serialManagerRef.current) return;
    await serialManagerRef.current.connect(machineConfig.baudRate, true);
  };

  // Disconnect serial
  const handleDisconnectSerial = async () => {
    if (!serialManagerRef.current) return;
    await serialManagerRef.current.disconnect();
  };

  // Clear logs
  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased selection:bg-amber-500/20 selection:text-amber-200">
      {/* 3-Zone Header Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serialState={serialState}
        onConnectSerial={handleConnectSerial}
        onDisconnectSerial={handleDisconnectSerial}
        onSimulateSerial={handleSimulateSerial}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5">
        {activeTab === 'gallery' && (
          <PrintGalleryPage
            onSelectImageForPlot={handleSelectImageForPlot}
            onOpenVectorizerWithImage={handleOpenVectorizerWithImage}
            machineConfig={machineConfig}
            imageConfig={imageConfig}
          />
        )}

        {activeTab === 'vectorizer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Configuration Column (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <ImageStudio
                imageConfig={imageConfig}
                setImageConfig={setImageConfig}
                machineConfig={machineConfig}
                onPathsGenerated={updatePlotJobWithPaths}
                onNavigateToGCodeStudio={() => setActiveTab('gcode')}
                onNavigateToController={() => setActiveTab('controller')}
                onNavigateToGallery={() => setActiveTab('gallery')}
                pathsCount={paths.length}
                externalImageSrc={externalImageSrc}
                externalImageTitle={externalImageTitle}
                onImageChange={(src, title) => {
                  setExternalImageSrc(src);
                  setExternalImageTitle(title);
                }}
              />
            </div>

            {/* Right Interactive Bed Visualizer Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="h-[620px]">
                <PlotterVisualizer
                  paths={paths}
                  machineConfig={machineConfig}
                  penThicknessMm={imageConfig.penThicknessMm}
                  onOptimizePaths={handleOptimizePaths}
                  onOpenGcodeModal={() => setIsGcodeModalOpen(true)}
                  onDownloadGcode={handleDownloadGcode}
                  plotJob={plotJob}
                  liveCoordinates={serialState.currentCoordinates}
                />
              </div>

              {/* Ready to Plot CTA Banner */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-semibold text-neutral-200">
                    Ready to generate &amp; plot?
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {plotJob
                      ? `${plotJob.gcodeLines.length.toLocaleString()} G-code lines ready (${(plotJob.totalDrawDistMm / 1000).toFixed(2)}m draw distance).`
                      : 'Load or upload an image to generate vector paths and G-Code.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-medium rounded-lg text-xs transition-colors border border-neutral-700"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Browse AI &amp; Gallery</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('gcode')}
                    disabled={!plotJob}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg text-xs transition-colors border border-neutral-700 disabled:opacity-40"
                  >
                    <Code className="w-3.5 h-3.5 text-amber-400" />
                    <span>G-Code Studio</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('controller')}
                    disabled={!plotJob}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors shadow-sm disabled:opacity-40"
                  >
                    <span>Run in Controller</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gcode' && (
          <GcodeStudio
            paths={paths}
            machineConfig={machineConfig}
            setMachineConfig={setMachineConfig}
            plotJob={plotJob}
            setPlotJob={setPlotJob}
            onSendToController={() => setActiveTab('controller')}
            onOptimizePaths={handleOptimizePaths}
          />
        )}

        {activeTab === 'controller' && (
          <CNCController
            serialState={serialState}
            serialManager={serialManagerRef.current}
            plotJob={plotJob}
            machineConfig={machineConfig}
            logs={logs}
            onClearLogs={handleClearLogs}
            onConnectSerial={handleConnectSerial}
            onSimulateSerial={handleSimulateSerial}
            onNavigateToGcode={() => setActiveTab('gcode')}
            onNavigateToVectorizer={() => setActiveTab('vectorizer')}
            onNavigateToGallery={() => setActiveTab('gallery')}
            paths={paths}
            imageSrc={externalImageSrc}
            imageTitle={externalImageTitle}
          />
        )}

        {activeTab === 'firmware' && (
          <FirmwareGuide
            machineConfig={machineConfig}
            setMachineConfig={setMachineConfig}
          />
        )}

        {activeTab === 'help' && <HelpPage />}
      </main>

      {/* G-Code Modal Inspector */}
      <GcodeViewerModal
        isOpen={isGcodeModalOpen}
        onClose={() => setIsGcodeModalOpen(false)}
        gcode={plotJob?.gcode || ''}
        filename={`pen_plot_${machineConfig.bedWidth}x${machineConfig.bedHeight}mm.gcode`}
      />

      {/* Clean Unboxed Footer */}
      <footer className="mt-auto border-t border-neutral-800/80 bg-neutral-950 py-4 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-300">PlotterCraft CNC</span>
            <span aria-hidden="true">·</span>
            <span>Arduino Uno (ATmega328P)</span>
            <span aria-hidden="true">·</span>
            <span>3 Steppers + 1 Servo Kinematics</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('gallery')}
              className="hover:text-amber-400 text-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>AI &amp; Print Gallery</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('vectorizer')}
              className="hover:text-neutral-200 transition-colors cursor-pointer"
            >
              1. Image Vectorizer
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('gcode')}
              className="hover:text-neutral-200 transition-colors cursor-pointer"
            >
              2. G-Code Studio
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('controller')}
              className="hover:text-neutral-200 transition-colors cursor-pointer"
            >
              3. CNC Controller
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('firmware')}
              className="hover:text-neutral-200 transition-colors cursor-pointer"
            >
              4. Firmware &amp; Wiring
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('help')}
              className="hover:text-amber-400 text-neutral-300 transition-colors cursor-pointer"
            >
              5. Help &amp; Forum
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
