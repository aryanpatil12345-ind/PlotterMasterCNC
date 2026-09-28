export type Point = [number, number]; // [x, y] in mm
export type Path = Point[];

export type AlgorithmType = 'contour' | 'hatching' | 'crosshatch' | 'spiral' | 'tsp';

export type PaperSizePreset = 'Square500' | 'A4' | 'A3' | 'Letter' | 'Square150' | 'Square300' | 'Custom';

export type QualityLevel = 'potato' | 'low' | 'medium' | 'high';

export interface ImageProcessingConfig {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  invert: boolean;
  threshold: number; // 0 to 255
  algorithm: AlgorithmType;
  qualityLevel?: QualityLevel;
  singleLineCenterline?: boolean; // When true: thick parts collapse into a single center line and image is shrunk
  shrinkRatio?: number; // Shrink scale factor (e.g. 0.65 for 65% scale)
  detailLevel: number; // 1 to 5 (resolution sampling factor)
  simplifyTolerance: number; // 0.05 to 2.0 mm
  hatchingAngle: number; // 0 to 180 degrees
  hatchingSpacing: number; // 0.5 to 8 mm
  spiralSpacing: number; // 0.5 to 6 mm
  tspMaxPoints: number; // 200 to 2500 points
  paperSize: PaperSizePreset;
  customWidth: number; // mm
  customHeight: number; // mm
  margin: number; // mm
  penThicknessMm: number; // mm for visual preview
}

export type KinematicType = 'dual_y' | 'cartesian' | 'corexy';

export interface MachineConfig {
  kinematics: KinematicType;
  bedWidth: number; // mm
  bedHeight: number; // mm
  stepsPerMmX: number;
  stepsPerMmY: number;
  feedrateRapid: number; // mm/min
  feedrateDraw: number; // mm/min
  penServoPin: number; // Arduino digital pin (e.g. 11 or 9)
  penUpAngle: number; // 0-180 deg
  penDownAngle: number; // 0-180 deg
  penLiftDelayMs: number; // milliseconds
  invertX: boolean;
  invertY: boolean;
  invertY2: boolean;
  xStepPin: number;
  xDirPin: number;
  yStepPin: number;
  yDirPin: number;
  y2StepPin: number;
  y2DirPin: number;
  enablePin: number;
  baudRate: number;
}

export interface PlotJob {
  paths: Path[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  totalDrawDistMm: number;
  totalRapidDistMm: number;
  penLiftsCount: number;
  estimatedDurationSec: number;
  gcode: string;
  gcodeLines: string[];
}

export type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'streaming' | 'paused' | 'error';

export interface SerialState {
  status: SerialStatus;
  portName: string;
  baudRate: number;
  isVirtual: boolean;
  progressPercent: number;
  currentLineIndex: number;
  totalLines: number;
  currentCoordinates: {
    x: number;
    y: number;
    penDown: boolean;
  };
  errorMessage?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'sent' | 'received' | 'info' | 'error' | 'warning';
  text: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  source: 'ai' | 'community' | 'default';
  description: string;
  author: string;
  imageUrl: string;
  thumbnailSvg?: string;
  tags: string[];
  complexity: 'Simple' | 'Medium' | 'Complex';
  aspectRatio: string;
  estimatedLines?: number;
  dateAdded?: string;
  likes?: number;
  defaultConfig?: Partial<ImageProcessingConfig>;
}
