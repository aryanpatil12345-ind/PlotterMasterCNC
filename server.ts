import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));

// Health & configuration status check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Gemini AI Image Generation Endpoint
app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const {
      prompt,
      aspectRatio = '1:1',
      referenceImage,
      style = 'line_art',
      quality = 'medium', // 'potato' | 'low' | 'medium' | 'high'
      singleLineShrunk = false,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured in environment or AI Studio Secrets.',
        isKeyMissing: true,
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const styleModifiers: Record<string, string> = {
      line_art: 'Crisp black vector line art on pure solid white background, minimal continuous line drawing, high contrast, clean sharp contours, no colors, no grayscale shading, pen plotter ready',
      blueprint: 'Technical blueprint architectural line drawing, pure white background with clean black technical pen strokes, schematic diagram, isometric engineering illustration',
      stipple: 'Black and white stippling and dotwork engraving illustration, distinct high-contrast ink dots and hatched lines on pure white paper',
      sketch: 'Leonardo da Vinci mechanical engineering sketch style, black ink line drawing, technical annotations and precise lines on clean white background',
      mandala: 'Intricate sacred geometry mandala, perfectly symmetrical vector circles and lines, sharp black line strokes on pure white background',
      woodcut: 'Vintage woodblock engraving style, bold dramatic black linework, cross-hatching, high contrast linocut print on plain white paper',
      single_line: 'Continuous unbroken single-line drawing style, fluid single pen stroke contour, zero pen lifts, minimalist black line on white canvas',
    };

    // Quality-specific modifiers and image sizes
    let imageSize: '512px' | '1K' | '2K' = '1K';
    let qualityPromptDetail = '';

    if (quality === 'potato') {
      imageSize = '512px';
      qualityPromptDetail = 'Simple broad line drawing, low detail, clear bold black silhouette contours.';
    } else if (quality === 'low') {
      imageSize = '1K';
      qualityPromptDetail = 'Standard clean line art, solid contours, moderate detail.';
    } else if (quality === 'medium') {
      imageSize = '1K';
      qualityPromptDetail = 'High detail, intricate clean pen lines, subtle geometric hatching, balanced density.';
    } else {
      // High
      imageSize = '2K';
      qualityPromptDetail = 'Masterpiece quality, ultra-high resolution line work, microscopic linework detail, exquisite cross-hatching and geometric perfection, mathematical precision pen plotting.';
    }

    const singleLineNote = singleLineShrunk
      ? ' SINGLE-LINE CENTERLINE & SHRUNK MODE: Thick parts and strokes MUST collapse into a single thin center stroke—never outline both sides of a thick line or fill solids. The overall artwork must be shrunk down into a compact central area (65% scale) with generous white space around all edges.'
      : '';

    const styleDesc = styleModifiers[style] || styleModifiers.line_art;
    const enrichedPrompt = `${prompt}. Style: ${styleDesc}. ${qualityPromptDetail}${singleLineNote} Ensure high-contrast solid black lines on pure solid white background without color wash or gradients, designed specifically for a 500x500mm mechanical CNC pen plotter.`;

    const parts: any[] = [];
    if (referenceImage) {
      const mimeMatch = referenceImage.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const base64Data = referenceImage.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType,
        },
      });
    }
    parts.push({ text: enrichedPrompt });

    // Use gemini-3-pro-image for High quality if possible, otherwise gemini-3.1-flash-image
    const modelToUse = quality === 'high' ? 'gemini-3-pro-image' : 'gemini-3.1-flash-image';

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: modelToUse,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any,
          },
        },
      });
    } catch (primaryErr: any) {
      console.warn(`Primary image model ${modelToUse} failed, falling back to gemini-3.1-flash-image:`, primaryErr?.message);
      // Fallback to gemini-3.1-flash-image with 1K/2K
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: (imageSize === '2K' ? '2K' : '1K') as any,
          },
        },
      });
    }

    let generatedImageUrl: string | null = null;
    let textResponse = '';

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      } else if (part.text) {
        textResponse += part.text;
      }
    }

    if (!generatedImageUrl) {
      return res.status(500).json({
        error: 'No image was returned by Gemini model.',
        details: textResponse,
      });
    }

    return res.json({
      success: true,
      imageUrl: generatedImageUrl,
      prompt,
      quality,
      modelUsed: modelToUse,
    });
  } catch (err: any) {
    console.warn('Warning generating image via Gemini:', err?.message || err);
    return res.status(500).json({
      error: err.message || 'Failed to generate image',
      details: err.toString(),
    });
  }
});

// Gemini AI Vector SVG Generation Endpoint (Switched from Gemini 3.8 to Gemini 3.1 Pro with deep thinking)
app.post('/api/ai/generate-svg', async (req, res) => {
  try {
    const { prompt, quality = 'high', singleLineShrunk = false } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured', isKeyMissing: true });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    // Thinking budget & instructions configured per quality level
    // Potato: quick draft with low token count
    // Low: standard thinking (2,048 tokens)
    // Medium: deep thinking (8,192 tokens)
    // High: thorough extended thinking (16,384 tokens) for museum-grade plotter paths
    let thinkingBudget = 8192;
    let qualityGuidelines = '';

    if (quality === 'potato') {
      thinkingBudget = 1024;
      qualityGuidelines = 'Create a simple, bold vector outline with minimal path nodes and straightforward geometric forms. Fast to plot.';
    } else if (quality === 'low') {
      thinkingBudget = 2048;
      qualityGuidelines = 'Create clean vector strokes with moderate detail and clear contours.';
    } else if (quality === 'medium') {
      thinkingBudget = 8192;
      qualityGuidelines = 'Create intricate vector artwork with rich linear hatching, smooth continuous curves, and architectural precision.';
    } else {
      // High
      thinkingBudget = 16384;
      qualityGuidelines = 'Take as much time as needed to think deeply through every vector coordinate. Create a breathtaking, museum-grade masterpiece drawing with ultra-dense multi-layer hatching, intricate mathematical curves, da Vinci mechanical precision, and continuous strokes optimized for pen plotting.';
    }

    if (singleLineShrunk) {
      qualityGuidelines += ' CRITICAL SINGLE-LINE RULE: All thick parts, letters, or shapes must receive only a SINGLE CENTERLINE stroke—do not draw double outlines or filled blocks. Also, SHRINK the drawing by 35% so it sits compactly in the center (coordinates bounded within -160 to +160 mm).';
    }

    // Try primary model gemini-3.1-pro-preview with thinking, fallback to gemini-3.8-flash / gemini-3.1-flash-lite on 503 or high demand
    let response: any;
    let modelUsed = 'gemini-3.1-pro-preview';
    const svgPrompt = `You are an expert computational generative artist and CNC plotter engineer.
Create an extraordinary SVG vector line drawing for a 500x500mm CNC pen plotter bed based on the prompt:
"${prompt}"

Quality Level: ${quality.toUpperCase()}
Quality Instructions: ${qualityGuidelines}

Technical Plotter Rules:
- The coordinate canvas is a 500x500 square: <svg xmlns="http://www.w3.org/2000/svg" viewBox="-250 -250 500 500" width="500" height="500">
- Notice the origin (0, 0) is right in the center! Coordinates range from X: -250 to +250 and Y: -250 to +250.
- Background must be a clean white rectangle: <rect x="-250" y="-250" width="500" height="500" fill="#ffffff"/>
- All vector strokes must use: stroke="#000000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"
- Use continuous <path d="..." />, <circle />, <line />, <polyline /> elements.
- Ensure all strokes are centered around (0, 0).
- Output ONLY the raw SVG code. Do not wrap in markdown or backticks, do not include preamble or conversational text.`;

    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: svgPrompt,
        config: {
          thinkingConfig: {
            thinkingBudget,
          },
        },
      });
    } catch (primaryErr: any) {
      console.warn('Gemini 3.1 Pro unavailable (high demand or 503), trying gemini-3.8-flash fallback:', primaryErr?.message);
      try {
        modelUsed = 'gemini-3.8-flash';
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: svgPrompt,
        });
      } catch (secondaryErr: any) {
        console.warn('Gemini 3.8 Flash unavailable, trying gemini-3.1-flash-lite fallback:', secondaryErr?.message);
        modelUsed = 'gemini-3.1-flash-lite';
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: svgPrompt,
        });
      }
    }

    const text = response?.text || '';
    const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
    const svg = svgMatch ? svgMatch[0] : text;

    return res.json({
      success: true,
      svg,
      quality,
      modelUsed,
      thinkingBudget,
    });
  } catch (err: any) {
    console.warn('Warning generating SVG via Gemini:', err?.message);
    return res.status(500).json({ error: err.message || 'Failed to generate SVG' });
  }
});

// Built-in intelligent plotter troubleshooting fallback knowledge base
function generateLocalPlotterAdvice(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('drag') || q.includes('travel') || q.includes('g0') || q.includes('scratches') || q.includes('paper')) {
    return `### 🖊️ Pen Dragging During G0 Rapid Moves & Travel Fixes

**Cause:** The pen is not lifting high enough or the machine starts traveling before the physical servo arm finishes swinging into the UP position.

**1. G-Code Lift Delay:**
In GRBL, rapid \`G0\` moves execute immediately. If your G-code sends \`M5\` (or \`M3 S0\`) followed immediately by \`G0 X... Y...\`, add a **Dwell Command (\`G4 P0.2\`)** to allow 200 milliseconds for the servo horn to lift the pen:
\`\`\`text
M5          ; Command pen lift
G4 P0.2     ; Dwell 200ms to allow physical servo travel
G0 X100 Y50 ; Safe rapid travel above paper
\`\`\`

**2. Mechanical Spring Tension:**
Ensure your pen slider has a light return spring or rubber band pulling the pen UP when the servo horn pulls back, counteracting gravity.

**3. Paper Flatness:**
On a large 500x500mm drawing bed, large sheets of paper can bow or buckle upward in the center. Use painter's blue tape or low-tack magnetic hold-downs to keep the paper flat across the entire bed.`;
  }

  if (q.includes('vref') || q.includes('current') || q.includes('hot') || q.includes('a4988') || q.includes('drv8825') || q.includes('overheating')) {
    return `### ⚡ Stepper Driver Current (Vref) Tuning Guide

**Targeting NEMA 17 Steppers (Typically 1.2A to 1.5A rated current):**

**1. A4988 Formula (using 0.1Ω or 0.068Ω sense resistors):**
\`\`\`text
Vref = I_max * 8 * R_sense
\`\`\`
- For standard A4988 boards with **R100 (0.10Ω)** sense resistors at 1.0A run current:
  - **Ideal Vref:** \`1.0 * 8 * 0.10 = 0.80V\` (Safe range: **0.70V – 0.85V**)

**2. Tuning Procedure:**
- Connect 12V/24V power to CNC Shield.
- Put multimeter in **DC Voltage** mode.
- Clip the black probe to **GND** on the shield.
- Touch the red probe to the **metal potentiometer wiper** on the driver board.
- Turn the trimmer screw gently using a ceramic or insulated screwdriver until voltage reads ~0.75V.
- If motors run too hot to touch (>70°C), turn counter-clockwise slightly to reduce current.`;
  }

  if (q.includes('baud') || q.includes('connect') || q.includes('serial') || q.includes('usb') || q.includes('com port') || q.includes('not detected')) {
    return `### 🔌 Web Serial & USB Connection Troubleshooting

**1. Baud Rate:**
- Standard GRBL 1.1f operates strictly at **115,200 baud** (8 data bits, no parity, 1 stop bit).
- Older GRBL 0.9 / 0.8 versions used 9,600 baud. In PlotterCraft, always use **115200**.

**2. Browser Permission (Web Serial API):**
- Web Serial is supported natively in **Google Chrome**, **Microsoft Edge**, and **Opera** on desktop.
- Requires HTTPS or localhost.

**3. CH340 / CP2102 Driver on Arduino Clones:**
- If your Arduino Uno is an inexpensive clone with a rectangular CH340 USB-UART chip, install the official **WCH CH340 / CH341 USB driver** so your operating system mounts it as a serial COM port.
- Close any other software (Arduino IDE Serial Monitor, LightBurn, Universal Gcode Sender) before connecting in PlotterCraft, as serial ports cannot be shared concurrently.`;
  }

  if (q.includes('servo') || q.includes('jitter') || q.includes('pen lift') || q.includes('sg90') || q.includes('pin 11')) {
    return `### ⚡ SG90 Servo & Pen-Lift Troubleshooting Guide

**1. Wiring to CNC Shield V3 & Arduino Uno:**
- **Signal (Orange/Yellow wire):** Connect to Arduino Pin 11. On standard CNC Shield V3, Pin 11 is routed to the **Z+ endstop pin** (or **SpnEn** header if GRBL 1.1f pin-mapping is enabled).
- **Power (Red wire):** 5V DC. *Warning:* Powering the servo directly from the Arduino Uno's onboard 5V regulator often causes brownouts and jitter when the motor moves. Use an external 5V 1A-2A power supply or dedicated 7805 regulator with common ground!
- **Ground (Brown/Black wire):** Connect to any GND pin on the shield, and ensure common ground with your power source.

**2. GRBL Configuration for Servo PWM:**
\`\`\`text
$32=0    ; Laser mode disabled (required for RC servo PWM pulse modulation)
$30=1000 ; Spindle maximum RPM (PWM pulse scale)
$31=0    ; Spindle minimum RPM
\`\`\`

**3. Pen Lift G-Codes:**
- **Pen UP (Travel):** \`M5\` or \`M3 S0\` (Servo horn at travel angle ~30°-45°)
- **Pen DOWN (Draw):** \`M3 S90\` or \`M3 S180\` (Servo horn lowers pen to paper ~75°-90°)
- Rapid moves (\`G0\`) should always execute while the pen is in the UP state!`;
  }

  if (q.includes('dual y') || q.includes('opposite') || q.includes('direction') || q.includes('fighting') || q.includes('a-axis')) {
    return `### 🔄 Dual-Y Stepper Motors Setup & Direction Fixing

**Why are the motors fighting each other or moving in opposite directions?**
When using dual Y-axis steppers cloned on CNC Shield V3 (using the 4th "A" driver slot):

1. **Jumper Configuration:**
   - Install two jumpers across the **A-Axis clone headers** labeled \`Y\` to mirror the Y-step and Y-dir pulses to the A driver.
2. **Motor Direction Inversion:**
   - If one Y motor spins forward while the other spins backward, **unplug power**, then rotate the 4-pin stepper plug of **ONE** of the Y motors 180 degrees.
   - Alternatively, invert the pair wiring (swap A+ with A-, or B+ with B- for one motor only).
3. **Mechanical Alignment (Racking):**
   - Before powering on, pull both left and right Y carriages against physical end-stops to ensure the gantry is square to the 500x500mm bed frame!`;
  }

  if (q.includes('steps') || q.includes('calibrate') || q.includes('scale') || q.includes('size') || q.includes('mm') || q.includes('$100') || q.includes('$101')) {
    return `### 📐 Steps/mm Calibration for 500x500mm Bed

**Standard Formula:**
\`\`\`text
Steps/mm = (Motor Steps per Rev * Microstepping) / (Pulley Teeth * Belt Pitch)
\`\`\`

**For Common GT2 Belt & NEMA 17 Steppers:**
- Motor: 1.8° step angle = **200 steps/rev**
- Belt: GT2 pitch = **2.0 mm**
- Pulley: **16-tooth** or **20-tooth**
- Driver: A4988 set to 1/16 microstepping (all 3 jumpers installed under driver) = **16 microsteps**

**Calculations:**
- **16-tooth pulley:** (200 * 16) / (16 * 2.0) = **100.0 steps/mm**
- **20-tooth pulley:** (200 * 16) / (20 * 2.0) = **80.0 steps/mm** (Default in PlotterCraft)

**To set in GRBL Console:**
\`\`\`text
$100=80.000   ; X-axis steps/mm
$101=80.000   ; Y-axis steps/mm
$110=4000.0   ; X Max rate (mm/min)
$111=4000.0   ; Y Max rate (mm/min)
$120=300.0    ; X Acceleration (mm/sec^2)
$121=300.0    ; Y Acceleration (mm/sec^2)
$130=500.0    ; X Max travel (500mm)
$131=500.0    ; Y Max travel (500mm)
\`\`\``;
  }

  if (q.includes('center') || q.includes('origin') || q.includes('(0,0)') || q.includes('500x500') || q.includes('middle')) {
    return `### 🎯 500x500mm Center Origin (0,0) Coordinate System

**How Center Coordinates Work:**
- Work Envelope: **500 mm × 500 mm**
- Center Origin: **(X: 0, Y: 0)** is located right in the dead center of the physical drawing surface.
- Coordinate Limits:
  - **X Range:** \`-250.0 mm\` (far left) to \`+250.0 mm\` (far right)
  - **Y Range:** \`-250.0 mm\` (bottom edge) to \`+250.0 mm\` (top edge)

**Workflow:**
1. Jog the pen carriage to the physical middle of your 500x500mm paper.
2. In CNC Controller, click **"Zero (0,0)"** to send \`G92 X0 Y0\` (or \`G10 L20 P1 X0 Y0\`).
3. Now all vector paths will draw symmetrically from the center outward!`;
  }

  if (q.includes('single-line') || q.includes('centerline') || q.includes('skeleton') || q.includes('potato') || q.includes('thinning')) {
    return `### ✂️ Single-Line Centerline Thinning & Shrunk Mode Guide

**How it works:**
1. **Collapses Thick Fills to 1-Pixel Skeletons:** Rather than tracing outer perimeter boundaries on both sides of a thick line, the vectorizer uses **Zhang-Suen morphological skeletonization** to compute the single continuous medial stroke.
2. **Reduced Pen Lifts:** Connects endpoints into continuous toolpaths, reducing pen lifts by up to 70%.
3. **Centered 65% Shrunk Fit:** Centers the drawing neatly within -160 to +160mm of the 500x500mm bed.
4. **Availability:** Toggleable directly in **Potato**, **Low**, and **Medium** quality modes in the Image Vectorizer and AI Print Gallery.`;
  }

  return `### 🤖 PlotterCraft AI Assistant & Hardware Reference

Here are key diagnostic parameters for your 500x500mm CNC Pen Plotter:

1. **Hardware Configuration:**
   - Bed: 500mm × 500mm square with center origin \`(0,0)\` ranging from \`-250\` to \`+250\` on X and Y.
   - Steppers: 3 NEMA 17 motors (dual Y-steppers cloned on CNC Shield V3 "A" driver slot).
   - Pen Lift: SG90 micro-servo connected to Arduino Pin 11 (Z+ endstop or SpnEn header).
2. **Pen Up/Down G-Code Standards:**
   - Pen UP: \`M5\` or \`M3 S0\` (with rapid travel \`G0\`)
   - Pen DOWN: \`M3 S90\` (with plotting feed \`G1\`)
3. **Common GRBL Settings ($):**
   - \`$32=0\` (Laser mode OFF for RC servo PWM)
   - \`$30=1000\` (Max spindle PWM speed)
   - \`$100=80.000\` & \`$101=80.000\` (Standard 20T GT2 steps/mm at 1/16 microstepping)
   - \`$130=500.000\` & \`$131=500.000\` (500mm envelope limits)

*Need assistance with wiring diagrams, motor calibration, or troubleshooting a specific error? Ask away!*`;
}

// Gemini AI Help Assistant Endpoint (Resilient Q&A and troubleshooting for plotters)
app.post('/api/ai/help-assistant', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        success: true,
        reply: generateLocalPlotterAdvice(message),
        isFallback: true,
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are the PlotterCraft Master CNC Engineer, a world-class expert on DIY 2D pen plotters, CNC machines, GRBL firmware, Arduino Uno, and vector toolpath generation.
Machine specifics:
- Bed: 500x500 mm square drawing area with center origin (0,0) spanning -250mm to +250mm on both X and Y.
- Motors: 3 NEMA 17 steppers (Dual-Y cloned on A driver of CNC Shield V3) and 1 TowerPro SG90 micro-servo for pen lift connected to Arduino Pin 11 (SpnEn / Z+ header).
- Firmware: GRBL 1.1f with RC servo PWM modification ($32=0 laser mode off, $30=1000 max spindle speed, M3 S... for pen down, M5 for pen up).
- Vectorizer: Supports contour tracing, hatching, spiral, TSP, and Zhang-Suen morphological single-line centerline thinning for Potato/Low/Medium modes with 65% shrunk ratio.
Provide crisp, structured technical answers with clear headings, exact GRBL commands ($100, $101, etc.), G-code snippets, or step-by-step wiring instructions. Be encouraging, thorough, and highly knowledgeable.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        contents.push({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Multi-tier model fallback strategy:
    // Try gemini-3.8-flash first; if 503 (high demand) or unavailable, try gemini-3.1-flash-lite, then fallback knowledge engine.
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let replyText = '';
    let usedModel = '';

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.35,
          },
        });
        if (response.text) {
          replyText = response.text;
          usedModel = model;
          break;
        }
      } catch (modelErr: any) {
        // Soft warning without throwing or polluting error monitoring
        console.warn(`[Help Assistant] Model ${model} unavailable (${modelErr?.status || modelErr?.message || 'error'}), trying next fallback...`);
      }
    }

    if (replyText) {
      return res.json({
        success: true,
        reply: replyText,
        isFallback: false,
        modelUsed: usedModel,
      });
    }

    // If both models are experiencing high demand (e.g. 503 status), gracefully provide local expert plotter advice
    return res.json({
      success: true,
      reply: generateLocalPlotterAdvice(message),
      isFallback: true,
      note: 'Model temporarily under high demand; answered via built-in PlotterCraft Knowledge Engine.',
    });
  } catch (err: any) {
    console.warn('Notice in help assistant handler:', err?.message || err);
    return res.json({
      success: true,
      reply: generateLocalPlotterAdvice(req.body?.message || ''),
      isFallback: true,
    });
  }
});

// Vite middleware or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlotterCraft server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
