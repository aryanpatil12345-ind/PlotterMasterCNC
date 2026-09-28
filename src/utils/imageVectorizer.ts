import { Point, Path, ImageProcessingConfig } from '../types/plotter';

/**
 * Distance squared between two 2D points
 */
function distSq(p1: Point, p2: Point): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return dx * dx + dy * dy;
}

/**
 * Ramer-Douglas-Peucker algorithm to simplify polylines
 */
export function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const tolSq = tolerance * tolerance;
  const first = points[0];
  const last = points[points.length - 1];

  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const lineLenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    let dSq = 0;
    if (lineLenSq === 0) {
      dSq = distSq(points[i], first);
    } else {
      const t = Math.max(0, Math.min(1, ((points[i][0] - first[0]) * dx + (points[i][1] - first[1]) * dy) / lineLenSq));
      const projX = first[0] + t * dx;
      const projY = first[1] + t * dy;
      dSq = distSq(points[i], [projX, projY]);
    }

    if (dSq > maxDist) {
      maxDist = dSq;
      index = i;
    }
  }

  if (maxDist > tolSq) {
    const rec1 = simplifyPath(points.slice(0, index + 1), tolerance);
    const rec2 = simplifyPath(points.slice(index), tolerance);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [first, last];
  }
}

/**
 * Greedy path reordering to minimize G0 rapid transit between separate strokes
 */
export function optimizePaths(paths: Path[]): Path[] {
  if (paths.length <= 1) return paths;

  const remaining = paths.filter(p => p.length >= 2).map(p => [...p]);
  if (remaining.length === 0) return [];

  const optimized: Path[] = [];
  let currentPos: Point = [0, 0];

  while (remaining.length > 0) {
    let bestDistSq = Infinity;
    let bestIndex = 0;
    let reverse = false;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      const startDist = distSq(currentPos, p[0]);
      if (startDist < bestDistSq) {
        bestDistSq = startDist;
        bestIndex = i;
        reverse = false;
      }
      const endDist = distSq(currentPos, p[p.length - 1]);
      if (endDist < bestDistSq) {
        bestDistSq = endDist;
        bestIndex = i;
        reverse = true;
      }
    }

    const chosen = remaining.splice(bestIndex, 1)[0];
    if (reverse) {
      chosen.reverse();
    }
    optimized.push(chosen);
    currentPos = chosen[chosen.length - 1];
  }

  return optimized;
}

/**
 * Helper to process an image source (Image / Canvas) and extract grayscale pixel buffer
 */
export function getPreprocessedImageData(
  img: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  config: ImageProcessingConfig
): { data: Uint8ClampedArray; width: number; height: number } {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context');

  // Fill white background first
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw scaled
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;

  // Brightness (-100 to 100) -> factor
  const bright = config.brightness * 1.5;
  // Contrast (-100 to 100) -> factor
  const contrastFactor = (259 * (config.contrast + 255)) / (255 * (259 - config.contrast));

  // Calculate min and max luminance for histogram normalization
  let minGray = 255;
  let maxGray = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3] / 255;
    // Composite over white if translucent
    const compR = r * a + 255 * (1 - a);
    const compG = g * a + 255 * (1 - a);
    const compB = b * a + 255 * (1 - a);
    const gray = 0.299 * compR + 0.587 * compG + 0.114 * compB;
    if (gray < minGray) minGray = gray;
    if (gray > maxGray) maxGray = gray;
  }

  const grayRange = Math.max(1, maxGray - minGray);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3] / 255;

    // Composite over white
    const compR = r * a + 255 * (1 - a);
    const compG = g * a + 255 * (1 - a);
    const compB = b * a + 255 * (1 - a);

    let gray = 0.299 * compR + 0.587 * compG + 0.114 * compB;

    // Normalize contrast range to expand details
    gray = ((gray - minGray) / grayRange) * 255;

    // Apply brightness
    gray += bright;

    // Apply contrast
    gray = contrastFactor * (gray - 128) + 128;

    // Clamp
    gray = Math.max(0, Math.min(255, gray));

    if (config.invert) {
      gray = 255 - gray;
    }

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    data[i + 3] = 255;
  }

  return { data, width: targetWidth, height: targetHeight };
}

/**
 * Contour vectorization using Sobel edge filter and neighbor tracing with adaptive fallback
 */
export function generateContourPaths(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  simplifyTolerance: number
): Path[] {
  // Grayscale buffer
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = pixelData[i * 4];
  }

  // Sobel Edge magnitude
  const magnitudes = new Float32Array(width * height);
  let maxMag = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[(y - 1) * width + (x - 1)] +
        gray[(y - 1) * width + (x + 1)] -
        2 * gray[y * width + (x - 1)] +
        2 * gray[y * width + (x + 1)] -
        gray[(y + 1) * width + (x - 1)] +
        gray[(y + 1) * width + (x + 1)];

      const gy =
        -gray[(y - 1) * width + (x - 1)] -
        2 * gray[(y - 1) * width + x] -
        gray[(y - 1) * width + (x + 1)] +
        gray[(y + 1) * width + (x - 1)] +
        2 * gray[(y + 1) * width + x] +
        gray[(y + 1) * width + (x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      magnitudes[idx] = mag;
      if (mag > maxMag) maxMag = mag;
    }
  }

  // Adaptive thresholding: if user threshold is too high for this image's gradient range, scale it
  const effectiveThreshold = maxMag > 0
    ? Math.min(threshold, maxMag * 0.45)
    : threshold;

  const edges = new Uint8Array(width * height);
  for (let i = 0; i < magnitudes.length; i++) {
    edges[i] = magnitudes[i] > effectiveThreshold ? 255 : 0;
  }

  // Trace connected edges into polylines
  const visited = new Uint8Array(width * height);
  const rawPaths: Path[] = [];

  const neighbors = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1]
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const startIdx = y * width + x;
      if (edges[startIdx] === 255 && visited[startIdx] === 0) {
        const path: Point[] = [[x, y]];
        visited[startIdx] = 1;
        let currX = x;
        let currY = y;

        let searching = true;
        while (searching) {
          let foundNext = false;
          for (const [nx, ny] of neighbors) {
            const nextX = currX + nx;
            const nextY = currY + ny;
            if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
              const nextIdx = nextY * width + nextX;
              if (edges[nextIdx] === 255 && visited[nextIdx] === 0) {
                visited[nextIdx] = 1;
                path.push([nextX, nextY]);
                currX = nextX;
                currY = nextY;
                foundNext = true;
                break;
              }
            }
          }
          if (!foundNext) {
            searching = false;
          }
        }

        if (path.length >= 3) {
          rawPaths.push(path);
        }
      }
    }
  }

  // Simplify and return
  return rawPaths.map(p => simplifyPath(p, simplifyTolerance));
}

/**
 * Parallel Line Hatching & Cross-Hatching algorithm
 */
export function generateHatchingPaths(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number,
  config: ImageProcessingConfig,
  crosshatch: boolean = false
): Path[] {
  const paths: Path[] = [];
  const spacing = Math.max(1.5, config.hatchingSpacing * (width / 200));
  const angleRad = (config.hatchingAngle * Math.PI) / 180;
  const thresh = config.threshold;

  function sampleGrayscale(x: number, y: number): number {
    const ix = Math.floor(Math.max(0, Math.min(width - 1, x)));
    const iy = Math.floor(Math.max(0, Math.min(height - 1, y)));
    return pixelData[(iy * width + ix) * 4];
  }

  function generatePass(angle: number, thresholdOffset: number) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const maxDim = Math.hypot(width, height);
    const numLines = Math.floor((maxDim * 2) / spacing);
    const cx = width / 2;
    const cy = height / 2;

    for (let i = -numLines / 2; i <= numLines / 2; i++) {
      const offset = i * spacing;
      // Perpendicular line origin
      const originX = cx + offset * -sinA;
      const originY = cy + offset * cosA;

      let currentStroke: Point[] | null = null;
      const step = 2; // step along line in pixels

      for (let t = -maxDim; t <= maxDim; t += step) {
        const px = originX + t * cosA;
        const py = originY + t * sinA;

        if (px >= 0 && px < width && py >= 0 && py < height) {
          const gray = sampleGrayscale(px, py);
          // Darker areas (low gray value) get drawn
          const isDraw = gray < (thresh + thresholdOffset);

          if (isDraw) {
            if (!currentStroke) {
              currentStroke = [[px, py]];
            } else {
              currentStroke.push([px, py]);
            }
          } else {
            if (currentStroke && currentStroke.length >= 2) {
              paths.push(simplifyPath(currentStroke, config.simplifyTolerance));
            }
            currentStroke = null;
          }
        } else {
          if (currentStroke && currentStroke.length >= 2) {
            paths.push(simplifyPath(currentStroke, config.simplifyTolerance));
          }
          currentStroke = null;
        }
      }

      if (currentStroke && currentStroke.length >= 2) {
        paths.push(simplifyPath(currentStroke, config.simplifyTolerance));
      }
    }
  }

  // Primary hatching pass
  generatePass(angleRad, 0);

  // Secondary cross-hatch pass for darker shadows
  if (crosshatch) {
    generatePass(angleRad + Math.PI / 2, -35);
  }

  return paths;
}

/**
 * Spiral Single-Line vector generator
 */
export function generateSpiralPaths(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number,
  config: ImageProcessingConfig
): Path[] {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  const spiralSpacing = Math.max(1.5, config.spiralSpacing * (width / 200));

  const path: Point[] = [];
  let theta = 0;
  const thetaStep = 0.05; // radians
  const thresh = config.threshold;

  while (true) {
    // Archimedean spiral radius: r = b * theta
    const baseR = (theta / (2 * Math.PI)) * spiralSpacing;
    if (baseR > maxR) break;

    // Sample image darkness at current point
    const x = cx + baseR * Math.cos(theta);
    const y = cy + baseR * Math.sin(theta);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const gray = pixelData[(iy * width + ix) * 4];
      const darkness = Math.max(0, 1 - gray / thresh);

      // Amplitude wiggle based on darkness
      const wiggle = darkness * (spiralSpacing * 0.45) * Math.sin(theta * 12);
      const modR = baseR + wiggle;

      const px = cx + modR * Math.cos(theta);
      const py = cy + modR * Math.sin(theta);
      path.push([px, py]);
    } else {
      path.push([x, y]);
    }

    theta += thetaStep;
  }

  return path.length > 2 ? [simplifyPath(path, config.simplifyTolerance)] : [];
}

/**
 * Stippling + TSP (Traveling Salesperson) Single-Stroke Art
 */
export function generateTSPPaths(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number,
  config: ImageProcessingConfig
): Path[] {
  const maxPoints = Math.min(2200, Math.max(150, config.tspMaxPoints));
  const stipples: Point[] = [];
  const thresh = config.threshold;

  // Luminance rejection sampling
  const step = Math.max(2, Math.floor(Math.sqrt((width * height) / (maxPoints * 3))));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const gray = pixelData[idx];
      const darkness = 1 - gray / 255;

      if (gray < thresh && Math.random() < darkness * 1.5) {
        // Add slight jitter
        const jx = Math.max(0, Math.min(width - 1, x + (Math.random() - 0.5) * step));
        const jy = Math.max(0, Math.min(height - 1, y + (Math.random() - 0.5) * step));
        stipples.push([jx, jy]);
      }
    }
  }

  // Limit to maxPoints
  if (stipples.length > maxPoints) {
    stipples.length = maxPoints;
  }

  if (stipples.length < 2) return [];

  // Greedy Nearest Neighbor Tour for single stroke
  const tour: Point[] = [stipples[0]];
  const unvisited = new Set<number>();
  for (let i = 1; i < stipples.length; i++) unvisited.add(i);

  let current = stipples[0];
  while (unvisited.size > 0) {
    let nearestIdx = -1;
    let minDistSq = Infinity;

    for (const idx of unvisited) {
      const p = stipples[idx];
      const dSq = distSq(current, p);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearestIdx = idx;
      }
    }

    if (nearestIdx !== -1) {
      unvisited.delete(nearestIdx);
      current = stipples[nearestIdx];
      tour.push(current);
    } else {
      break;
    }
  }

  return [simplifyPath(tour, config.simplifyTolerance)];
}

/**
 * Zhang-Suen morphological thinning (skeletonization) algorithm.
 * Converts thick dark strokes/shapes into 1-pixel wide centerlines,
 * so thick parts are drawn with a single pen line instead of double contours.
 */
export function zhangSuenThinning(
  binary: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const grid = new Uint8Array(binary);
  let changed = true;
  let iter = 0;
  const maxIter = 60;

  while (changed && iter < maxIter) {
    changed = false;
    iter++;

    for (let step = 1; step <= 2; step++) {
      const toDelete: number[] = [];

      for (let y = 1; y < height - 1; y++) {
        const row = y * width;
        const rowUp = (y - 1) * width;
        const rowDown = (y + 1) * width;

        for (let x = 1; x < width - 1; x++) {
          const idx = row + x;
          if (grid[idx] === 0) continue;

          // 8 neighbors (P2 to P9 clockwise starting from North)
          const p2 = grid[rowUp + x];
          const p3 = grid[rowUp + (x + 1)];
          const p4 = grid[row + (x + 1)];
          const p5 = grid[rowDown + (x + 1)];
          const p6 = grid[rowDown + x];
          const p7 = grid[rowDown + (x - 1)];
          const p8 = grid[row + (x - 1)];
          const p9 = grid[rowUp + (x - 1)];

          // Condition 1: 2 <= B(P1) <= 6
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;

          // Condition 2: A(P1) = 1 (number of 0 -> 1 transitions in P2..P9, P2)
          let a = 0;
          if (p2 === 0 && p3 === 1) a++;
          if (p3 === 0 && p4 === 1) a++;
          if (p4 === 0 && p5 === 1) a++;
          if (p5 === 0 && p6 === 1) a++;
          if (p6 === 0 && p7 === 1) a++;
          if (p7 === 0 && p8 === 1) a++;
          if (p8 === 0 && p9 === 1) a++;
          if (p9 === 0 && p2 === 1) a++;
          if (a !== 1) continue;

          // Step 1: P2 * P4 * P6 == 0 and P4 * P6 * P8 == 0
          // Step 2: P2 * P4 * P8 == 0 and P2 * P6 * P8 == 0
          if (step === 1) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }

          toDelete.push(idx);
        }
      }

      if (toDelete.length > 0) {
        changed = true;
        for (let i = 0; i < toDelete.length; i++) {
          grid[toDelete[i]] = 0;
        }
      }
    }
  }

  return grid;
}

/**
 * Traces a 1-pixel-wide thinned skeleton grid into continuous vector paths
 */
export function traceSkeletonPaths(
  skeleton: Uint8Array,
  width: number,
  height: number,
  simplifyTolerance: number
): Path[] {
  const visited = new Uint8Array(width * height);
  const paths: Path[] = [];

  // Helper to count active neighbors
  const countNeighbors = (x: number, y: number): number => {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (skeleton[ny * width + nx] === 1) count++;
        }
      }
    }
    return count;
  };

  // Find stroke endpoints (degree 1) first for natural pen movement
  const endpoints: [number, number][] = [];
  const otherPoints: [number, number][] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (skeleton[idx] === 1) {
        if (countNeighbors(x, y) === 1) {
          endpoints.push([x, y]);
        } else {
          otherPoints.push([x, y]);
        }
      }
    }
  }

  // Trace a path walking 8-neighbor skeleton pixels
  const traceFrom = (startX: number, startY: number) => {
    const startIdx = startY * width + startX;
    if (visited[startIdx]) return;

    const path: Point[] = [[startX, startY]];
    visited[startIdx] = 1;

    let currX = startX;
    let currY = startY;

    let walking = true;
    while (walking) {
      let nextX = -1;
      let nextY = -1;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = currX + dx;
          const ny = currY + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (skeleton[nIdx] === 1 && !visited[nIdx]) {
              nextX = nx;
              nextY = ny;
              break;
            }
          }
        }
        if (nextX !== -1) break;
      }

      if (nextX !== -1) {
        visited[nextY * width + nextX] = 1;
        path.push([nextX, nextY]);
        currX = nextX;
        currY = nextY;
      } else {
        walking = false;
      }
    }

    if (path.length >= 2) {
      paths.push(simplifyPath(path, simplifyTolerance));
    }
  };

  // Walk stroke endpoints first
  for (const [x, y] of endpoints) {
    traceFrom(x, y);
  }

  // Walk remaining loop/cycle points
  for (const [x, y] of otherPoints) {
    traceFrom(x, y);
  }

  return paths;
}

/**
 * Centerline Single-Line Vector Path Generator:
 * Used for potato/low/medium modes to turn thick strokes/solids into a single center pen stroke.
 */
export function generateCenterlinePaths(
  pixelData: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  simplifyTolerance: number
): Path[] {
  // 1. Binary image: 1 for dark foreground (drawn pen strokes), 0 for white background
  const binary = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = pixelData[idx];
      if (gray < threshold) {
        binary[y * width + x] = 1;
      }
    }
  }

  // 2. Morphological thinning to 1px wide centerline skeleton
  const skeleton = zhangSuenThinning(binary, width, height);

  // 3. Trace skeleton pixels into polylines
  return traceSkeletonPaths(skeleton, width, height, simplifyTolerance);
}

/**
 * Coordinate transform: Maps pixel coordinates into physical Plotter Bed Millimeters (mm).
 * By default, 0, 0 is right in the middle of the bed!
 * If shrinkFactor < 1.0 (e.g. 0.65), the design is shrunk cleanly in the center of the bed.
 */
export function scalePathsToBed(
  paths: Path[],
  imgWidth: number,
  imgHeight: number,
  bedWidthMm: number,
  bedHeightMm: number,
  marginMm: number = 10,
  centerOrigin: boolean = true,
  shrinkFactor: number = 1.0
): Path[] {
  if (paths.length === 0) return [];

  const safeShrink = Math.max(0.2, Math.min(1.0, shrinkFactor));
  const printableW = Math.max(10, (bedWidthMm - marginMm * 2) * safeShrink);
  const printableH = Math.max(10, (bedHeightMm - marginMm * 2) * safeShrink);

  const scale = Math.min(printableW / imgWidth, printableH / imgHeight);

  if (centerOrigin) {
    // 0, 0 in the middle:
    // X: from -targetW/2 to +targetW/2
    // Y: from -targetH/2 to +targetH/2 (positive Y upwards)
    return paths.map(path =>
      path.map(([px, py]) => [
        parseFloat(((px - imgWidth / 2) * scale).toFixed(2)),
        parseFloat(((imgHeight / 2 - py) * scale).toFixed(2))
      ])
    );
  }

  const targetW = imgWidth * scale;
  const targetH = imgHeight * scale;

  // Corner origin fallback
  const offsetX = marginMm + (printableW - targetW) / 2;
  const offsetY = marginMm + (printableH - targetH) / 2;

  return paths.map(path =>
    path.map(([px, py]) => [
      parseFloat((offsetX + px * scale).toFixed(2)),
      // Invert Y so 0,0 is bottom-left CNC coordinate standard
      parseFloat((bedHeightMm - (offsetY + py * scale)).toFixed(2))
    ])
  );
}
