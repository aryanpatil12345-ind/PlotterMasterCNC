import { GalleryItem } from '../types/plotter';

// Helper to generate canvas data URLs for built-in high-contrast plotter classics
export function createGearDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  const cx = 250, cy = 250;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;

  const teeth = 18;
  const outerR = 190;
  const innerR = 160;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i * Math.PI) / teeth;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 55, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(cx + 95 * Math.cos(a), cy + 95 * Math.sin(a), 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  return c.toDataURL('image/png');
}

export function createOrigamiCraneDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const lines: [[number, number], [number, number]][] = [
    [[250, 60], [160, 220]],
    [[250, 60], [340, 220]],
    [[160, 220], [340, 220]],
    [[160, 220], [250, 320]],
    [[340, 220], [250, 320]],
    [[250, 320], [250, 440]],
    [[160, 220], [60, 160]],
    [[60, 160], [250, 320]],
    [[340, 220], [440, 160]],
    [[440, 160], [250, 320]],
    [[250, 60], [250, 220]],
    [[250, 220], [160, 390]],
    [[250, 220], [340, 390]],
    [[160, 390], [250, 440]],
    [[340, 390], [250, 440]],
    [[60, 160], [30, 200]],
    [[30, 200], [110, 240]],
    [[440, 160], [480, 220]],
    [[480, 220], [390, 240]],
  ];

  ctx.beginPath();
  lines.forEach(([start, end]) => {
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
  });
  ctx.stroke();

  return c.toDataURL('image/png');
}

export function createMandalaDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  const cx = 250, cy = 250;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;

  // Concentric guideline rings
  [220, 180, 140, 100, 60, 25].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 12-fold sacred geometry petals
  const petals = 12;
  for (let i = 0; i < petals; i++) {
    const a = (i * Math.PI * 2) / petals;
    const aNext = ((i + 1) * Math.PI * 2) / petals;
    const aMid = (a + aNext) / 2;

    // Outer pointed petal
    ctx.beginPath();
    ctx.moveTo(cx + 180 * Math.cos(a), cy + 180 * Math.sin(a));
    ctx.quadraticCurveTo(
      cx + 235 * Math.cos(aMid),
      cy + 235 * Math.sin(aMid),
      cx + 180 * Math.cos(aNext),
      cy + 180 * Math.sin(aNext)
    );
    ctx.stroke();

    // Inner petal
    ctx.beginPath();
    ctx.moveTo(cx + 100 * Math.cos(a), cy + 100 * Math.sin(a));
    ctx.quadraticCurveTo(
      cx + 155 * Math.cos(aMid),
      cy + 155 * Math.sin(aMid),
      cx + 100 * Math.cos(aNext),
      cy + 100 * Math.sin(aNext)
    );
    ctx.stroke();

    // Secondary sub-petals
    ctx.beginPath();
    ctx.arc(cx + 140 * Math.cos(a), cy + 140 * Math.sin(a), 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Central star
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    const r = i % 2 === 0 ? 60 : 35;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  return c.toDataURL('image/png');
}

export function createHilbertCurveDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const order = 4;
  const n = Math.pow(2, order);
  const total = n * n;
  const margin = 40;
  const size = 500 - margin * 2;
  const step = size / n;

  function d2xy(m: number, d: number): [number, number] {
    let rx: number, ry: number, s: number, t = d;
    let x = 0, y = 0;
    for (s = 1; s < m; s *= 2) {
      rx = 1 & (t / 2);
      ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) {
          x = s - 1 - x;
          y = s - 1 - y;
        }
        const temp = x;
        x = y;
        y = temp;
      }
      x += s * rx;
      y += s * ry;
      t = Math.floor(t / 4);
    }
    return [x, y];
  }

  ctx.beginPath();
  for (let i = 0; i < total; i++) {
    const [gx, gy] = d2xy(n, i);
    const px = margin + (gx + 0.5) * step;
    const py = margin + (gy + 0.5) * step;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  return c.toDataURL('image/png');
}

export function createFibonacciSpiralDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;

  const cx = 250, cy = 250;
  const a = 3.5;
  const b = 0.175;

  ctx.beginPath();
  let first = true;
  for (let theta = 0; theta < Math.PI * 8; theta += 0.05) {
    const r = a * Math.exp(b * theta);
    if (r > 230) break;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    if (first) {
      ctx.moveTo(x, y);
      first = false;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw concentric harmonic circles & rays
  ctx.lineWidth = 1;
  [40, 80, 130, 190].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 220 * Math.cos(angle), cy + 220 * Math.sin(angle));
    ctx.stroke();
  }

  return c.toDataURL('image/png');
}

export function createCalibrationTortureGridDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';

  // Perimeter border
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, 440, 440);

  // Diagonal cross
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(30, 30);
  ctx.lineTo(470, 470);
  ctx.moveTo(470, 30);
  ctx.lineTo(30, 470);
  ctx.stroke();

  // Precision 20mm grid
  ctx.lineWidth = 1;
  for (let i = 50; i <= 450; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, 30);
    ctx.lineTo(i, 470);
    ctx.moveTo(30, i);
    ctx.lineTo(470, i);
    ctx.stroke();
  }

  // Concentric circle calibration target
  [20, 40, 60, 80, 100, 130].forEach((r) => {
    ctx.beginPath();
    ctx.arc(250, 250, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Vernier test combs
  for (let k = 0; k < 12; k++) {
    const x = 50 + k * 8;
    ctx.beginPath();
    ctx.moveTo(x, 50);
    ctx.lineTo(x, 50 + (k % 2 === 0 ? 25 : 15));
    ctx.stroke();
  }

  return c.toDataURL('image/png');
}

export function createApolloLanderDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const lines: [[number, number], [number, number]][] = [
    // Ascent stage cabin
    [[200, 140], [300, 140]],
    [[300, 140], [340, 190]],
    [[340, 190], [340, 250]],
    [[340, 250], [160, 250]],
    [[160, 250], [160, 190]],
    [[160, 190], [200, 140]],

    // Triangular crew windows
    [[210, 170], [240, 170]],
    [[240, 170], [225, 200]],
    [[225, 200], [210, 170]],
    [[260, 170], [290, 170]],
    [[290, 170], [275, 200]],
    [[275, 200], [260, 170]],

    // Descent stage octagonal body
    [[140, 250], [360, 250]],
    [[360, 250], [380, 330]],
    [[380, 330], [120, 330]],
    [[120, 330], [140, 250]],

    // Engine bell
    [[220, 330], [210, 370]],
    [[280, 330], [290, 370]],
    [[210, 370], [290, 370]],

    // Landing gear struts & footpads
    [[140, 290], [50, 420]],
    [[120, 330], [50, 420]],
    [[20, 420], [80, 420]], // Left footpad

    [[360, 290], [450, 420]],
    [[380, 330], [450, 420]],
    [[420, 420], [480, 420]], // Right footpad

    [[220, 330], [180, 420]],
    [[150, 420], [210, 420]], // Center left footpad

    [[280, 330], [320, 420]],
    [[290, 420], [350, 420]], // Center right footpad

    // Radar dish & antenna
    [[250, 140], [250, 90]],
    [[230, 90], [270, 90]],
    [[220, 80], [280, 80]],
  ];

  ctx.beginPath();
  lines.forEach(([start, end]) => {
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
  });
  ctx.stroke();

  return c.toDataURL('image/png');
}

export function createBonsaiInkDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Pot
  ctx.strokeRect(150, 400, 200, 35);
  ctx.beginPath();
  ctx.moveTo(170, 435);
  ctx.lineTo(165, 455);
  ctx.moveTo(330, 435);
  ctx.lineTo(335, 455);
  ctx.stroke();

  // Twisted Trunk
  ctx.beginPath();
  ctx.moveTo(250, 400);
  ctx.bezierCurveTo(230, 350, 180, 310, 210, 260);
  ctx.bezierCurveTo(240, 210, 310, 230, 330, 180);
  ctx.bezierCurveTo(340, 140, 290, 120, 270, 110);
  ctx.stroke();

  // Branches
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(205, 270);
  ctx.quadraticCurveTo(150, 260, 110, 230);
  ctx.moveTo(225, 235);
  ctx.quadraticCurveTo(270, 220, 370, 210);
  ctx.moveTo(310, 175);
  ctx.quadraticCurveTo(390, 150, 420, 130);
  ctx.stroke();

  // Foliage clouds (concentric cloud loops)
  const clouds = [
    [100, 220, 45],
    [140, 210, 40],
    [260, 100, 55],
    [310, 95, 50],
    [370, 195, 45],
    [415, 125, 40],
    [390, 150, 45],
  ];

  ctx.lineWidth = 1.8;
  clouds.forEach(([x, y, r]) => {
    for (let rad = r; rad > 10; rad -= 9) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  return c.toDataURL('image/png');
}

export function createTeslaMotorPatentDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;

  const cx = 250, cy = 250;

  // Stator rings
  ctx.beginPath();
  ctx.arc(cx, cy, 190, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 175, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.stroke();

  // 4 Pole Coils (North, South, East, West)
  const poles = [
    [cx, cy - 145],
    [cx + 145, cy],
    [cx, cy + 145],
    [cx - 145, cy],
  ];

  poles.forEach(([px, py]) => {
    ctx.strokeRect(px - 25, py - 25, 50, 50);
    // Coil windings
    for (let w = -20; w <= 20; w += 8) {
      ctx.beginPath();
      ctx.moveTo(px - 25, py + w);
      ctx.lineTo(px + 25, py + w);
      ctx.stroke();
    }
  });

  // Rotor cylinder
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.stroke();

  // Rotor shaft & Keyway
  ctx.beginPath();
  ctx.arc(cx, cy, 25, 0, Math.PI * 2);
  ctx.stroke();

  // Induction Copper Bars (12 bars)
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const bx = cx + 60 * Math.cos(a);
    const by = cy + 60 * Math.sin(a);
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Wiring schematics
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 145, cy - 25);
  ctx.lineTo(cx - 210, cy - 25);
  ctx.moveTo(cx - 145, cy + 25);
  ctx.lineTo(cx - 210, cy + 25);
  ctx.moveTo(cx + 145, cy - 25);
  ctx.lineTo(cx + 210, cy - 25);
  ctx.moveTo(cx + 145, cy + 25);
  ctx.lineTo(cx + 210, cy + 25);
  ctx.stroke();

  return c.toDataURL('image/png');
}

export function createDroneSchematicDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;

  const cx = 250, cy = 250;

  // Center airframe
  ctx.strokeRect(210, 210, 80, 80);
  ctx.beginPath();
  ctx.arc(cx, cy, 25, 0, Math.PI * 2);
  ctx.stroke();

  // 4 Diagonal carbon fiber arms
  const arms = [
    [100, 100],
    [400, 100],
    [400, 400],
    [100, 400],
  ];

  arms.forEach(([ax, ay]) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    // Motor Pod
    ctx.beginPath();
    ctx.arc(ax, ay, 22, 0, Math.PI * 2);
    ctx.stroke();

    // Propeller circle
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ax, ay, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Dual Blade Propeller
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(ax, ay, 65, 12, Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Gimbal camera unit
  ctx.lineWidth = 2;
  ctx.strokeRect(230, 290, 40, 30);
  ctx.beginPath();
  ctx.arc(250, 305, 10, 0, Math.PI * 2);
  ctx.stroke();

  return c.toDataURL('image/png');
}

export function createContinuousFaceDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Picasso-style single continuous stroke face
  ctx.beginPath();
  ctx.moveTo(180, 90);
  ctx.bezierCurveTo(240, 80, 310, 90, 340, 140);
  ctx.bezierCurveTo(360, 180, 360, 230, 340, 280);
  ctx.bezierCurveTo(320, 330, 290, 380, 260, 420);
  ctx.bezierCurveTo(230, 460, 190, 440, 180, 390);
  ctx.bezierCurveTo(170, 350, 190, 320, 230, 310); // Chin & jawline
  ctx.bezierCurveTo(260, 305, 270, 315, 285, 330); // Lips
  ctx.bezierCurveTo(270, 345, 250, 340, 240, 335);
  ctx.bezierCurveTo(230, 320, 220, 280, 230, 240); // Nose bridge
  ctx.bezierCurveTo(240, 200, 260, 190, 280, 195); // Right eye arch
  ctx.bezierCurveTo(300, 200, 310, 215, 290, 225);
  ctx.bezierCurveTo(270, 235, 250, 215, 235, 220); // Back across nose
  ctx.bezierCurveTo(215, 225, 190, 210, 175, 225); // Left eye arch
  ctx.bezierCurveTo(160, 240, 180, 255, 195, 245);
  ctx.bezierCurveTo(205, 240, 215, 260, 210, 290);
  ctx.stroke();

  return c.toDataURL('image/png');
}

// Built-in Default Classics Collection
export const DEFAULT_CLASSICS: GalleryItem[] = [
  {
    id: 'default_gear',
    title: 'Da Vinci Involute Gear & Escapement',
    category: 'Engineering & Mechanics',
    source: 'default',
    description: 'Precision mechanical spur gear with internal spokes, keyway, and pitch diameter lines. The gold-standard benchmark for testing CNC backlash and circle interpolation.',
    author: 'Leonardo da Vinci Archive',
    imageUrl: '', // dynamically filled
    tags: ['Mechanics', 'Gear', 'Engineering', 'Calibration', 'DaVinci'],
    complexity: 'Medium',
    aspectRatio: '1:1',
    estimatedLines: 320,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'default_crane',
    title: 'Geometric Origami Crane',
    category: 'Minimalist Line Art',
    source: 'default',
    description: 'Crisp, low-poly faceted origami crane folded from Japanese washi paper. Clean vertex lines optimized for swift pen plotter plotting without excessive pen lifts.',
    author: 'PlotterCraft Core',
    imageUrl: '',
    tags: ['Origami', 'Faceted', 'LowPoly', 'Geometric', 'Bird'],
    complexity: 'Simple',
    aspectRatio: '1:1',
    estimatedLines: 95,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'default_mandala',
    title: 'Sacred Geometry 12-Fold Mandala',
    category: 'Sacred Geometry & Fractals',
    source: 'default',
    description: 'Harmonic 12-fold floral mandala combining concentric guideline rings, overlapping petal curves, and an octagonal star core. Creates mesmerizing hypnotizing ink strokes.',
    author: 'Sacred Line Collective',
    imageUrl: '',
    tags: ['Mandala', 'SacredGeometry', 'Symmetry', 'Floral', 'Meditation'],
    complexity: 'Complex',
    aspectRatio: '1:1',
    estimatedLines: 840,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'default_hilbert',
    title: 'Hilbert Space-Filling Curve (N=4)',
    category: 'Fractals & Algorithms',
    source: 'default',
    description: 'Single continuous unbroken space-filling fractal path that visits every coordinate on the bed without lifting the pen once! Ultimate torture test for stepper reliability.',
    author: 'David Hilbert 1891',
    imageUrl: '',
    tags: ['Fractal', 'Hilbert', 'Math', 'ContinuousLine', 'ZeroPenLift'],
    complexity: 'Medium',
    aspectRatio: '1:1',
    estimatedLines: 256,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'default_fibonacci',
    title: 'Golden Ratio Fibonacci Spiral',
    category: 'Mathematics & Science',
    source: 'default',
    description: 'Logarithmic golden ratio spiral phi (1.618) with harmonic concentric orbital rings and radial spokes. Smooth continuous circular arc test for stepper motors.',
    author: 'Fibonacci Math Labs',
    imageUrl: '',
    tags: ['Fibonacci', 'GoldenRatio', 'Spiral', 'Mathematics', 'Curves'],
    complexity: 'Simple',
    aspectRatio: '1:1',
    estimatedLines: 180,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'default_torture_grid',
    title: 'CNC Stepper Calibration & Torture Grid',
    category: 'Calibration & Benchmarks',
    source: 'default',
    description: 'Official mechanical calibration print containing 20mm reference squares, diagonal squareness verification, concentric backlash rings, and vernier pitch comb.',
    author: 'CNC Standards Bureau',
    imageUrl: '',
    tags: ['Calibration', 'TortureTest', 'Backlash', 'StepsPerMm', 'Squareness'],
    complexity: 'Complex',
    aspectRatio: '1:1',
    estimatedLines: 610,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'default_apollo',
    title: 'NASA Apollo 11 Lunar Module Blueprint',
    category: 'Schematics & Patents',
    source: 'default',
    description: 'Detailed technical elevation schematic of the Eagle LM descent and ascent stages, including landing pads, thrusters, radar antenna, and triangular cockpit windows.',
    author: 'NASA Historical Archives',
    imageUrl: '',
    tags: ['NASA', 'Apollo11', 'Space', 'Blueprint', 'Schematic'],
    complexity: 'Complex',
    aspectRatio: '1:1',
    estimatedLines: 540,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
];

// Curated Community Uploaded Collection
export const COMMUNITY_ITEMS: GalleryItem[] = [
  {
    id: 'comm_tesla_motor',
    title: 'Nikola Tesla Polyphase Induction Motor (1888)',
    category: 'Schematics & Patents',
    source: 'community',
    description: 'Patent schematic reproduction of Tesla’s breakthrough alternating current induction motor with 4 stator field windings and squirrel-cage rotor.',
    author: '@tesla_archivist',
    imageUrl: '',
    tags: ['Patent', 'Tesla', 'Motor', 'Electrical', 'Engineering'],
    complexity: 'Medium',
    aspectRatio: '1:1',
    estimatedLines: 410,
    likes: 342,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'comm_drone',
    title: 'Autonomous Racing Quadcopter Top-View',
    category: 'Engineering & Mechanics',
    source: 'community',
    description: 'Top-down mechanical schematic showing carbon fiber X-frame, brushless motors, aerodynamic prop sweeps, and central camera gimbal.',
    author: '@rotor_craftsman',
    imageUrl: '',
    tags: ['Drone', 'Quadcopter', 'Aviation', 'Schematic', 'FPV'],
    complexity: 'Medium',
    aspectRatio: '1:1',
    estimatedLines: 380,
    likes: 218,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'comm_bonsai',
    title: 'Old Pine Bonsai Sumi-e Ink Wash',
    category: 'Nature & Wildlife',
    source: 'community',
    description: 'Contoured Asian sumi-e style twisted pine bonsai with concentric cloud foliage clusters planted in an artisanal ceramic tray.',
    author: '@zen_plotter',
    imageUrl: '',
    tags: ['Bonsai', 'Japanese', 'Nature', 'Tree', 'InkWash'],
    complexity: 'Medium',
    aspectRatio: '1:1',
    estimatedLines: 460,
    likes: 489,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
  {
    id: 'comm_picasso_face',
    title: 'Continuous Line Modernist Portrait',
    category: 'Minimalist Line Art',
    source: 'community',
    description: 'Single flowing contour face in the style of mid-century cubism. Flowing unbroken facial features that draw smoothly with fluid elegance.',
    author: '@continuous_flow',
    imageUrl: '',
    tags: ['Portrait', 'ContinuousLine', 'Picasso', 'Minimalist', 'ModernArt'],
    complexity: 'Simple',
    aspectRatio: '1:1',
    estimatedLines: 120,
    likes: 512,
    defaultConfig: { algorithm: 'contour', threshold: 128 },
  },
];

// Initialize images on demand
let initialized = false;
export function initializeGalleryData(): { defaults: GalleryItem[]; community: GalleryItem[] } {
  if (!initialized) {
    DEFAULT_CLASSICS[0].imageUrl = createGearDataUrl();
    DEFAULT_CLASSICS[1].imageUrl = createOrigamiCraneDataUrl();
    DEFAULT_CLASSICS[2].imageUrl = createMandalaDataUrl();
    DEFAULT_CLASSICS[3].imageUrl = createHilbertCurveDataUrl();
    DEFAULT_CLASSICS[4].imageUrl = createFibonacciSpiralDataUrl();
    DEFAULT_CLASSICS[5].imageUrl = createCalibrationTortureGridDataUrl();
    DEFAULT_CLASSICS[6].imageUrl = createApolloLanderDataUrl();

    COMMUNITY_ITEMS[0].imageUrl = createTeslaMotorPatentDataUrl();
    COMMUNITY_ITEMS[1].imageUrl = createDroneSchematicDataUrl();
    COMMUNITY_ITEMS[2].imageUrl = createBonsaiInkDataUrl();
    COMMUNITY_ITEMS[3].imageUrl = createContinuousFaceDataUrl();
    initialized = true;
  }
  return { defaults: DEFAULT_CLASSICS, community: COMMUNITY_ITEMS };
}
