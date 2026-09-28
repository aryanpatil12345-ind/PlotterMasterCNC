import { Path, MachineConfig, PlotJob } from '../types/plotter';

export function generateGCode(paths: Path[], config: MachineConfig): PlotJob {
  const gcodeLines: string[] = [];

  let totalDrawDistMm = 0;
  let totalRapidDistMm = 0;
  let penLiftsCount = 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let currentPos = [0, 0];

  // Header comments
  gcodeLines.push('; ===================================================');
  gcodeLines.push('; PlotterCraft CNC - Pen Plotter G-Code');
  gcodeLines.push(`; Bed Size: ${config.bedWidth} x ${config.bedHeight} mm`);
  gcodeLines.push(`; Kinematics: ${config.kinematics}`);
  gcodeLines.push(`; Draw Speed: ${config.feedrateDraw} mm/min | Rapid Speed: ${config.feedrateRapid} mm/min`);
  gcodeLines.push(`; Pen Up Angle: ${config.penUpAngle}° | Pen Down Angle: ${config.penDownAngle}°`);
  gcodeLines.push('; ===================================================');

  // Initialization
  gcodeLines.push('G21 ; Units: Millimeters');
  gcodeLines.push('G90 ; Absolute coordinates');
  gcodeLines.push(`M3 S${config.penUpAngle} ; Ensure Pen is UP`);
  gcodeLines.push(`G4 P${config.penLiftDelayMs} ; Wait for servo`);
  gcodeLines.push(`G0 F${config.feedrateRapid} ; Set rapid feedrate`);

  for (const path of paths) {
    if (path.length < 2) continue;

    const startPt = path[0];

    // Rapid travel to start point (Pen is UP)
    const rapidDx = startPt[0] - currentPos[0];
    const rapidDy = startPt[1] - currentPos[1];
    const rapidDist = Math.hypot(rapidDx, rapidDy);
    totalRapidDistMm += rapidDist;

    gcodeLines.push(`G0 X${startPt[0].toFixed(2)} Y${startPt[1].toFixed(2)} F${config.feedrateRapid}`);
    currentPos = [startPt[0], startPt[1]];

    // Lower Pen
    gcodeLines.push(`M3 S${config.penDownAngle} ; Pen DOWN`);
    gcodeLines.push(`G4 P${config.penLiftDelayMs} ; Servo settle`);

    // Draw along path
    for (let i = 1; i < path.length; i++) {
      const pt = path[i];
      const drawDx = pt[0] - currentPos[0];
      const drawDy = pt[1] - currentPos[1];
      const drawDist = Math.hypot(drawDx, drawDy);
      totalDrawDistMm += drawDist;

      // Update bounds
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];

      gcodeLines.push(`G1 X${pt[0].toFixed(2)} Y${pt[1].toFixed(2)} F${config.feedrateDraw}`);
      currentPos = [pt[0], pt[1]];
    }

    // Lift Pen
    gcodeLines.push(`M3 S${config.penUpAngle} ; Pen UP`);
    gcodeLines.push(`G4 P${config.penLiftDelayMs} ; Servo settle`);
    penLiftsCount++;
  }

  // Footer / Return home
  const finalRapidDist = Math.hypot(currentPos[0], currentPos[1]);
  totalRapidDistMm += finalRapidDist;
  gcodeLines.push(`G0 X0 Y0 F${config.feedrateRapid} ; Return to origin`);
  gcodeLines.push('M84 ; Disable stepper motors');
  gcodeLines.push('; End of plot');

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  // Estimate duration
  const drawTimeSec = (totalDrawDistMm / (config.feedrateDraw / 60));
  const rapidTimeSec = (totalRapidDistMm / (config.feedrateRapid / 60));
  const servoDelayTotalSec = (penLiftsCount * 2 * config.penLiftDelayMs) / 1000;
  const estimatedDurationSec = Math.round(drawTimeSec + rapidTimeSec + servoDelayTotalSec);

  return {
    paths,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: parseFloat((maxX - minX).toFixed(2)),
      height: parseFloat((maxY - minY).toFixed(2))
    },
    totalDrawDistMm: parseFloat(totalDrawDistMm.toFixed(1)),
    totalRapidDistMm: parseFloat(totalRapidDistMm.toFixed(1)),
    penLiftsCount,
    estimatedDurationSec,
    gcode: gcodeLines.join('\n'),
    gcodeLines
  };
}

/**
 * Parses raw G-Code text back into vector paths and PlotJob metrics for visual simulation
 */
export function parseGCodeToPaths(gcodeText: string, config: MachineConfig): PlotJob {
  const lines = gcodeText.split(/\r?\n/);
  const paths: Path[] = [];
  let currentStroke: [number, number][] = [];

  let currentX = 0;
  let currentY = 0;
  let isPenDown = false;

  let totalDrawDistMm = 0;
  let totalRapidDistMm = 0;
  let penLiftsCount = 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rawLine of lines) {
    const line = rawLine.trim().toUpperCase();
    if (!line || line.startsWith(';')) continue;

    // Check Pen Down / Up commands
    if (line.includes('M3')) {
      const sMatch = line.match(/S([0-9]+)/);
      if (sMatch) {
        const angle = parseInt(sMatch[1], 10);
        // If angle is closer to downAngle, it's pen down
        const penDown = angle >= 60;
        if (penDown && !isPenDown) {
          isPenDown = true;
          currentStroke = [[currentX, currentY]];
        } else if (!penDown && isPenDown) {
          isPenDown = false;
          penLiftsCount++;
          if (currentStroke.length >= 2) {
            paths.push(currentStroke);
          }
          currentStroke = [];
        }
      } else {
        if (!isPenDown) {
          isPenDown = true;
          currentStroke = [[currentX, currentY]];
        }
      }
    } else if (line.includes('M5')) {
      if (isPenDown) {
        isPenDown = false;
        penLiftsCount++;
        if (currentStroke.length >= 2) {
          paths.push(currentStroke);
        }
        currentStroke = [];
      }
    }

    // Coordinates
    const isG0 = line.startsWith('G0') || line.startsWith('G00');
    const isG1 = line.startsWith('G1') || line.startsWith('G01');

    if (isG0 || isG1) {
      let targetX = currentX;
      let targetY = currentY;

      const xMatch = line.match(/X([0-9.-]+)/);
      if (xMatch) targetX = parseFloat(xMatch[1]);

      const yMatch = line.match(/Y([0-9.-]+)/);
      if (yMatch) targetY = parseFloat(yMatch[1]);

      const dist = Math.hypot(targetX - currentX, targetY - currentY);

      if (isG0) {
        totalRapidDistMm += dist;
      } else if (isG1) {
        totalDrawDistMm += dist;
      }

      currentX = targetX;
      currentY = targetY;

      if (targetX < minX) minX = targetX;
      if (targetX > maxX) maxX = targetX;
      if (targetY < minY) minY = targetY;
      if (targetY > maxY) maxY = targetY;

      if (isPenDown) {
        currentStroke.push([targetX, targetY]);
      }
    }
  }

  if (currentStroke.length >= 2) {
    paths.push(currentStroke);
  }

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const drawTimeSec = (totalDrawDistMm / (config.feedrateDraw / 60));
  const rapidTimeSec = (totalRapidDistMm / (config.feedrateRapid / 60));
  const servoDelayTotalSec = (penLiftsCount * 2 * config.penLiftDelayMs) / 1000;
  const estimatedDurationSec = Math.round(drawTimeSec + rapidTimeSec + servoDelayTotalSec);

  return {
    paths,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: parseFloat((maxX - minX).toFixed(2)),
      height: parseFloat((maxY - minY).toFixed(2))
    },
    totalDrawDistMm: parseFloat(totalDrawDistMm.toFixed(1)),
    totalRapidDistMm: parseFloat(totalRapidDistMm.toFixed(1)),
    penLiftsCount,
    estimatedDurationSec,
    gcode: gcodeText,
    gcodeLines: lines
  };
}

/**
 * Generates geometric calibration patterns for testing pen plotter mechanics
 */
export function generateCalibrationPattern(
  type: 'boundary_box' | 'crosshair' | 'concentric_circles' | 'speed_ladder' | 'spiral_vortex',
  config: MachineConfig
): Path[] {
  const w = config.bedWidth;
  const h = config.bedHeight;
  const cx = w / 2;
  const cy = h / 2;

  if (type === 'boundary_box') {
    const m = 15;
    return [
      [
        [m, m],
        [w - m, m],
        [w - m, h - m],
        [m, h - m],
        [m, m]
      ],
      // Corner alignment marks
      [[m, m], [m + 15, m + 15]],
      [[w - m, m], [w - m - 15, m + 15]],
      [[w - m, h - m], [w - m - 15, h - m - 15]],
      [[m, h - m], [m + 15, h - m - 15]]
    ];
  }

  if (type === 'crosshair') {
    const paths: Path[] = [];
    const size = Math.min(w, h) * 0.35;
    // Major axes
    paths.push([[cx - size, cy], [cx + size, cy]]);
    paths.push([[cx, cy - size], [cx, cy + size]]);

    // Tick marks every 10mm
    for (let offset = -size; offset <= size; offset += 10) {
      if (offset === 0) continue;
      paths.push([[cx + offset, cy - 3], [cx + offset, cy + 3]]);
      paths.push([[cx - 3, cy + offset], [cx + 3, cy + offset]]);
    }
    return paths;
  }

  if (type === 'concentric_circles') {
    const paths: Path[] = [];
    const maxR = Math.min(w, h) * 0.35;
    for (let r = 10; r <= maxR; r += 12) {
      const circle: [number, number][] = [];
      const segments = 48;
      for (let i = 0; i <= segments; i++) {
        const a = (i * 2 * Math.PI) / segments;
        circle.push([
          parseFloat((cx + r * Math.cos(a)).toFixed(2)),
          parseFloat((cy + r * Math.sin(a)).toFixed(2))
        ]);
      }
      paths.push(circle);
    }
    return paths;
  }

  if (type === 'speed_ladder') {
    const paths: Path[] = [];
    const startY = cy - 40;
    const len = Math.min(w * 0.7, 140);
    const startX = cx - len / 2;

    for (let i = 0; i < 8; i++) {
      const y = startY + i * 12;
      paths.push([
        [startX, y],
        [startX + len, y]
      ]);
    }
    return paths;
  }

  // Spiral vortex
  const spiral: [number, number][] = [];
  const maxR = Math.min(w, h) * 0.38;
  for (let theta = 0; theta < Math.PI * 18; theta += 0.1) {
    const r = (theta / (Math.PI * 18)) * maxR;
    spiral.push([
      parseFloat((cx + r * Math.cos(theta)).toFixed(2)),
      parseFloat((cy + r * Math.sin(theta)).toFixed(2))
    ]);
  }
  return [spiral];
}

