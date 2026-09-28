export interface SamplePreset {
  id: string;
  title: string;
  category: string;
  description: string;
  createImage: () => HTMLCanvasElement;
}

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'mechanical_gear',
    title: 'Da Vinci Involute Gear',
    category: 'Engineering',
    description: 'Precision mechanical gear with internal spokes and teeth',
    createImage: () => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);

      const cx = 200, cy = 200;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;

      // Outer gear with teeth
      const teeth = 16;
      const outerR = 150;
      const innerR = 125;
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

      // Pitch circles
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 45, 0, Math.PI * 2);
      ctx.stroke();

      // Center keyhole
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.stroke();

      // Spokes
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(cx + 75 * Math.cos(a), cy + 75 * Math.sin(a), 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      return c;
    }
  },
  {
    id: 'origami_bird',
    title: 'Geometric Origami Crane',
    category: 'Vector Art',
    description: 'Faceted low-poly origami crane ideal for clean pen lines',
    createImage: () => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      const lines = [
        [[200, 50], [130, 180]],
        [[200, 50], [270, 180]],
        [[130, 180], [270, 180]],
        [[130, 180], [200, 260]],
        [[270, 180], [200, 260]],
        [[200, 260], [200, 360]],
        [[130, 180], [50, 130]],
        [[50, 130], [200, 260]],
        [[270, 180], [350, 130]],
        [[350, 130], [200, 260]],
        [[200, 50], [200, 180]],
        [[200, 180], [130, 320]],
        [[200, 180], [270, 320]],
        [[130, 320], [200, 360]],
        [[270, 320], [200, 360]],
        [[50, 130], [25, 95]],
        [[25, 95], [130, 180]],
      ];

      for (const stroke of lines) {
        ctx.beginPath();
        ctx.moveTo(stroke[0][0], stroke[0][1]);
        ctx.lineTo(stroke[1][0], stroke[1][1]);
        ctx.stroke();
      }

      return c;
    }
  },
  {
    id: 'cyber_portrait',
    title: 'High-Contrast Portrait',
    category: 'Halftone / Hatch',
    description: 'Portrait with shaded contours, perfect for testing hatching & TSP',
    createImage: () => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);

      // Head silhouette
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.ellipse(200, 190, 85, 115, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.beginPath();
      ctx.arc(200, 140, 105, Math.PI * 0.8, Math.PI * 2.2);
      ctx.lineTo(310, 230);
      ctx.lineTo(90, 230);
      ctx.fill();

      // Face cutout
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(200, 195, 65, 85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Features in black
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      // Eyebrows
      ctx.beginPath();
      ctx.moveTo(160, 170);
      ctx.quadraticCurveTo(175, 160, 190, 168);
      ctx.moveTo(210, 168);
      ctx.quadraticCurveTo(225, 160, 240, 170);
      ctx.stroke();

      // Eyes
      ctx.beginPath();
      ctx.ellipse(175, 185, 10, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(225, 185, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.beginPath();
      ctx.moveTo(200, 180);
      ctx.lineTo(196, 215);
      ctx.lineTo(206, 215);
      ctx.stroke();

      // Lips
      ctx.beginPath();
      ctx.moveTo(182, 238);
      ctx.quadraticCurveTo(200, 233, 218, 238);
      ctx.quadraticCurveTo(200, 248, 182, 238);
      ctx.fill();

      // Neck & collar
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.moveTo(160, 275);
      ctx.lineTo(130, 380);
      ctx.lineTo(270, 380);
      ctx.lineTo(240, 275);
      ctx.closePath();
      ctx.fill();

      return c;
    }
  },
  {
    id: 'circuit_traces',
    title: 'PCB Circuit Routing',
    category: 'Technical',
    description: 'Orthogonal circuit pathways and IC solder pads',
    createImage: () => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Center IC chip
      ctx.strokeRect(150, 150, 100, 100);

      // IC Pins
      for (let i = 0; i < 5; i++) {
        const offset = 160 + i * 20;
        // Top
        ctx.beginPath();
        ctx.moveTo(offset, 150);
        ctx.lineTo(offset, 130);
        ctx.lineTo(offset + (i % 2 === 0 ? 30 : -30), 80);
        ctx.lineTo(offset + (i % 2 === 0 ? 30 : -30), 40);
        ctx.stroke();

        // Bottom
        ctx.beginPath();
        ctx.moveTo(offset, 250);
        ctx.lineTo(offset, 270);
        ctx.lineTo(offset + (i % 2 === 0 ? -30 : 30), 320);
        ctx.lineTo(offset + (i % 2 === 0 ? -30 : 30), 360);
        ctx.stroke();
      }

      // Vias (donut pads)
      const vias = [
        [60, 60], [60, 340], [340, 60], [340, 340],
        [100, 200], [300, 200]
      ];
      ctx.lineWidth = 3;
      for (const [vx, vy] of vias) {
        ctx.beginPath();
        ctx.arc(vx, vy, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vx, vy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      return c;
    }
  },
  {
    id: 'sacred_mandala',
    title: 'Sacred Geometric Mandala',
    category: 'Generative',
    description: 'Concentric interlocking petals and arcs for intricate plotting',
    createImage: () => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);

      const cx = 200, cy = 200;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;

      // Flower of life petals
      const r = 55;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Outer rosette
      const outerR = 110;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.arc(cx + outerR * Math.cos(a), cy + outerR * Math.sin(a), 40, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Concentric circles
      [30, 80, 140, 160].forEach(rad => {
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      });

      return c;
    }
  }
];
