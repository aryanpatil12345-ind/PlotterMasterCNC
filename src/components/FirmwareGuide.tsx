import React, { useState } from 'react';
import { Download, Copy, Check, Cpu, Wrench, AlertTriangle, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { MachineConfig, KinematicType } from '../types/plotter';
import { generateArduinoFirmware } from '../utils/firmwareGenerator';

interface FirmwareGuideProps {
  machineConfig: MachineConfig;
  setMachineConfig: React.Dispatch<React.SetStateAction<MachineConfig>>;
}

export const FirmwareGuide: React.FC<FirmwareGuideProps> = ({
  machineConfig,
  setMachineConfig,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'wiring' | 'steps'>('code');

  const generatedCode = generateArduinoFirmware(machineConfig);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PenPlotter_Uno_3Stepper_1Servo.ino`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5 text-xs">
      {/* Hero Overview Banner with Generated Real-Hardware Image */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center">
          <div className="md:col-span-7 p-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md mb-2">
              <Cpu className="w-3.5 h-3.5" />
              <span>Arduino Uno ATmega328P Firmware</span>
            </div>
            <h2 className="text-xl font-bold text-neutral-100 tracking-tight">
              3 Steppers + 1 Servo CNC Firmware
            </h2>
            <p className="text-neutral-400 text-xs mt-2 leading-relaxed max-w-xl">
              Arduino Uno has 2KB RAM and cannot process raster images on-chip. This firmware turns your Arduino into a precision CNC motion engine that communicates via USB serial with this web app, performing coordinated Bresenham linear steps across 3 stepper motors and smooth servo pen lifts.
            </p>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download .ino Sketch</span>
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg transition-colors border border-neutral-700"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-5 h-48 md:h-full relative overflow-hidden bg-neutral-950">
            <img
              src="/src/assets/images/cnc_pen_plotter_drawing_1790160770526.jpg"
              alt="CNC Pen Plotter Hardware"
              className="w-full h-full object-cover opacity-85 hover:opacity-100 transition-opacity"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-neutral-900 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Hardware Settings Customizer */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-neutral-200">Hardware & Kinematics Configuration</h3>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">Updates sketch in real-time</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Kinematics */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1 font-medium">Kinematics Style</label>
            <select
              value={machineConfig.kinematics}
              onChange={(e) =>
                setMachineConfig((prev) => ({ ...prev, kinematics: e.target.value as KinematicType }))
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
            >
              <option value="dual_y">Dual-Y Gantry (X, Y1, Y2 - CNC Shield A-axis)</option>
              <option value="cartesian">Standard Cartesian (X, Y, Z)</option>
              <option value="corexy">CoreXY (Motors A &amp; B + Aux)</option>
            </select>
            <p className="text-[10px] text-neutral-500 mt-1">Dual-Y is recommended for long gantry plotters.</p>
          </div>

          {/* Steps/mm X */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1 font-medium">X Steps / mm</label>
            <input
              type="number"
              step="0.1"
              value={machineConfig.stepsPerMmX}
              onChange={(e) =>
                setMachineConfig((prev) => ({ ...prev, stepsPerMmX: parseFloat(e.target.value) || 80 }))
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-hidden focus:border-amber-500"
            />
            <p className="text-[10px] text-neutral-500 mt-1">Default 80.0 (GT2 belt, 20T pulley, 1/16th step)</p>
          </div>

          {/* Steps/mm Y */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1 font-medium">Y Steps / mm</label>
            <input
              type="number"
              step="0.1"
              value={machineConfig.stepsPerMmY}
              onChange={(e) =>
                setMachineConfig((prev) => ({ ...prev, stepsPerMmY: parseFloat(e.target.value) || 80 }))
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-hidden focus:border-amber-500"
            />
            <p className="text-[10px] text-neutral-500 mt-1">Both Y1 and Y2 steppers sync to this ratio</p>
          </div>

          {/* Servo Pin */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1 font-medium">Servo PWM Pin</label>
            <input
              type="number"
              value={machineConfig.penServoPin}
              onChange={(e) =>
                setMachineConfig((prev) => ({ ...prev, penServoPin: parseInt(e.target.value) || 11 }))
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-hidden focus:border-amber-500"
            />
            <p className="text-[10px] text-neutral-500 mt-1">Pin 11 (SpnEn on CNC Shield V3) or Pin 9 (Z+)</p>
          </div>

          {/* Pen Up Angle */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1 font-medium">Pen UP Servo Angle (°)</label>
            <input
              type="number"
              min="0"
              max="180"
              value={machineConfig.penUpAngle}
              onChange={(e) =>
                setMachineConfig((prev) => ({ ...prev, penUpAngle: parseInt(e.target.value) || 35 }))
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Pen Down Angle */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1 font-medium">Pen DOWN Servo Angle (°)</label>
            <input
              type="number"
              min="0"
              max="180"
              value={machineConfig.penDownAngle}
              onChange={(e) =>
                setMachineConfig((prev) => ({ ...prev, penDownAngle: parseInt(e.target.value) || 95 }))
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Invert Motor directions */}
          <div className="flex items-center gap-4 sm:col-span-2 md:col-span-3 pt-2">
            <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={machineConfig.invertX}
                onChange={(e) => setMachineConfig((prev) => ({ ...prev, invertX: e.target.checked }))}
                className="rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <span>Invert X Direction</span>
            </label>

            <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={machineConfig.invertY}
                onChange={(e) => setMachineConfig((prev) => ({ ...prev, invertY: e.target.checked }))}
                className="rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <span>Invert Y Direction</span>
            </label>

            {machineConfig.kinematics === 'dual_y' && (
              <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={machineConfig.invertY2}
                  onChange={(e) => setMachineConfig((prev) => ({ ...prev, invertY2: e.target.checked }))}
                  className="rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Invert Y2 (Opposite Gantry Side)</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Navigation tabs for Code, Wiring, and Flashing Steps */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
        <button
          onClick={() => setActiveTab('code')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'code' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Arduino C++ Sketch (.ino)
        </button>
        <button
          onClick={() => setActiveTab('wiring')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'wiring' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          CNC Shield V3 Wiring &amp; Pinout
        </button>
        <button
          onClick={() => setActiveTab('steps')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'steps' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Flashing &amp; Calibration Guide
        </button>
      </div>

      {/* Tab 1: Code Viewer */}
      {activeTab === 'code' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
            <span className="font-mono text-xs text-neutral-400">PenPlotter_Uno_3Stepper_1Servo.ino</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded text-xs transition-colors flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ino</span>
              </button>
            </div>
          </div>
          <pre className="p-4 bg-neutral-950 text-neutral-300 font-mono text-[11px] overflow-x-auto max-h-[500px] leading-relaxed">
            {generatedCode}
          </pre>
        </div>
      )}

      {/* Tab 2: Wiring & Pinout Guide */}
      {activeTab === 'wiring' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Arduino Uno + CNC Shield V3 Pin Mapping</h3>
            <p className="text-neutral-400 text-xs mt-1">
              The CNC Shield V3 slots directly onto the Arduino Uno. Below is the exact electrical mapping used by the generated firmware:
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border border-neutral-800">
              <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="p-2.5">Component</th>
                  <th className="p-2.5">Arduino Uno Pin</th>
                  <th className="p-2.5">CNC Shield Header</th>
                  <th className="p-2.5">Function</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                <tr className="hover:bg-neutral-950/40">
                  <td className="p-2.5 font-bold text-neutral-200">X-Axis Stepper</td>
                  <td className="p-2.5 text-amber-400">Pin 2 (Step) / Pin 5 (Dir)</td>
                  <td className="p-2.5 text-neutral-300">X Driver Socket (A4988 / DRV8825)</td>
                  <td className="p-2.5 text-neutral-400">Carriage left/right horizontal movement</td>
                </tr>
                <tr className="hover:bg-neutral-950/40">
                  <td className="p-2.5 font-bold text-neutral-200">Y1-Axis Stepper</td>
                  <td className="p-2.5 text-amber-400">Pin 3 (Step) / Pin 6 (Dir)</td>
                  <td className="p-2.5 text-neutral-300">Y Driver Socket</td>
                  <td className="p-2.5 text-neutral-400">Primary gantry rail stepper motor</td>
                </tr>
                <tr className="hover:bg-neutral-950/40">
                  <td className="p-2.5 font-bold text-neutral-200">Y2-Axis (3rd Stepper)</td>
                  <td className="p-2.5 text-amber-400">Pin 12 (Step) / Pin 13 (Dir)</td>
                  <td className="p-2.5 text-neutral-300">A Driver Socket (Cloned or Jumpered to Y)</td>
                  <td className="p-2.5 text-neutral-400">Secondary parallel gantry rail stepper motor</td>
                </tr>
                <tr className="hover:bg-neutral-950/40">
                  <td className="p-2.5 font-bold text-neutral-200">Stepper Enable</td>
                  <td className="p-2.5 text-amber-400">Pin 8</td>
                  <td className="p-2.5 text-neutral-300">EN (Active LOW)</td>
                  <td className="p-2.5 text-neutral-400">Energizes/locks or disables all 3 steppers</td>
                </tr>
                <tr className="hover:bg-neutral-950/40">
                  <td className="p-2.5 font-bold text-rose-400">SG90 Servo (Pen Lift)</td>
                  <td className="p-2.5 text-rose-400">Pin 11 (Signal) + 5V + GND</td>
                  <td className="p-2.5 text-neutral-300">SpnEn (or Z+ Endstop header)</td>
                  <td className="p-2.5 text-neutral-400">PWM rotation raises/lowers the plotting pen</td>
                </tr>
                <tr className="hover:bg-neutral-950/40">
                  <td className="p-2.5 font-bold text-emerald-400">External Power</td>
                  <td className="p-2.5 text-emerald-400">12V DC (3A – 5A)</td>
                  <td className="p-2.5 text-neutral-300">Screw Terminal (+ / -)</td>
                  <td className="p-2.5 text-neutral-400">Powers stepper coils. NEVER power steppers via USB!</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300 space-y-1">
              <p className="font-semibold text-amber-300">Important CNC Shield V3 Jumpers &amp; Microstepping:</p>
              <p>
                1. Place 3 microstepping jumpers under EACH A4988 driver socket (MS1, MS2, MS3) to activate 1/16th microstepping (smooth, quiet motion).
              </p>
              <p>
                2. On the &ldquo;A Axis Clone&rdquo; jumper block on CNC Shield, place two jumpers vertically on the Y row if you want hardware cloning, or leave open if using direct Pin 12/13 software control.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Step-by-Step Flashing Instructions */}
      {activeTab === 'steps' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-neutral-100">Quick 4-Step Flashing Guide</h3>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </span>
              <div>
                <h4 className="font-semibold text-neutral-200 text-xs">Download &amp; Open in Arduino IDE</h4>
                <p className="text-neutral-400 text-xs mt-0.5">
                  Click &ldquo;Download .ino&rdquo; above. Open the file in the official Arduino IDE (v1.8 or v2.x). Built-in <code className="text-amber-300">Servo.h</code> is included with Arduino by default—no extra libraries needed!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </span>
              <div>
                <h4 className="font-semibold text-neutral-200 text-xs">Select Board &amp; USB Port</h4>
                <p className="text-neutral-400 text-xs mt-0.5">
                  In Arduino IDE menu: Select <strong>Tools &gt; Board &gt; Arduino Uno</strong>, then select your Arduino&apos;s COM port under <strong>Tools &gt; Port</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </span>
              <div>
                <h4 className="font-semibold text-neutral-200 text-xs">Upload Firmware</h4>
                <p className="text-neutral-400 text-xs mt-0.5">
                  Click the <strong>Upload</strong> arrow button. The Arduino Uno TX/RX LEDs will blink rapidly for 5-10 seconds until &ldquo;Done uploading&rdquo; appears.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                4
              </span>
              <div>
                <h4 className="font-semibold text-neutral-200 text-xs">Connect in Browser &amp; Print</h4>
                <p className="text-neutral-400 text-xs mt-0.5">
                  Close Arduino IDE&apos;s Serial Monitor (so the USB port is free), return to this web app, click <strong>&ldquo;Connect Arduino&rdquo;</strong> in the top header, and start auto-plotting your images!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
