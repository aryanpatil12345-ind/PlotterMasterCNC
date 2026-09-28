import { LogEntry, SerialState } from '../types/plotter';

export class WebSerialManager {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private readableStreamClosed: any = null;
  private writableStreamClosed: any = null;

  private isVirtual = false;
  private virtualTimer: any = null;

  private state: SerialState = {
    status: 'disconnected',
    portName: 'Not Connected',
    baudRate: 115200,
    isVirtual: false,
    progressPercent: 0,
    currentLineIndex: 0,
    totalLines: 0,
    currentCoordinates: { x: 0, y: 0, penDown: false }
  };

  private onStateChange: (state: SerialState) => void;
  private onLog: (log: LogEntry) => void;

  private streamingQueue: string[] = [];
  private streamingIndex = 0;
  private isAwaitingOk = false;
  private isPaused = false;
  private isAborted = false;

  constructor(
    onStateChange: (state: SerialState) => void,
    onLog: (log: LogEntry) => void
  ) {
    this.onStateChange = onStateChange;
    this.onLog = onLog;
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  private updateState(partial: Partial<SerialState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange(this.state);
  }

  private emitLog(type: LogEntry['type'], text: string) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      text
    };
    this.onLog(entry);
  }

  public async connect(baudRate: number = 115200, simulate = false): Promise<boolean> {
    if (simulate || !this.isWebSerialSupported()) {
      this.isVirtual = true;
      this.updateState({
        status: 'connected',
        portName: 'Virtual Arduino Uno (Simulator)',
        baudRate,
        isVirtual: true
      });
      this.emitLog('info', 'Connected to Virtual Arduino Uno Plotter Simulator (115200 baud)');
      this.emitLog('received', 'Grbl 1.1h [\'$\' for help]');
      this.emitLog('received', '[PlotterCraft CNC Uno 3-Stepper Ready]');
      this.emitLog('received', 'ok');
      return true;
    }

    try {
      this.updateState({ status: 'connecting' });
      this.emitLog('info', 'Requesting USB Serial Port from browser...');

      // @ts-ignore
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate });

      this.isVirtual = false;
      const portInfo = this.port.getInfo ? this.port.getInfo() : {};
      const usbVendor = portInfo.usbVendorId ? ` (VID: 0x${portInfo.usbVendorId.toString(16)})` : '';
      const portLabel = `Arduino Uno USB${usbVendor}`;

      this.updateState({
        status: 'connected',
        portName: portLabel,
        baudRate,
        isVirtual: false
      });

      this.emitLog('info', `Successfully opened port at ${baudRate} baud`);
      this.startReading();

      // Send initial newline to clear buffer
      await this.sendRaw('\r\n');
      return true;
    } catch (err: any) {
      this.updateState({
        status: 'error',
        errorMessage: err.message || 'Failed to open serial port'
      });
      this.emitLog('error', `Connection error: ${err.message || 'User cancelled or port busy'}`);
      return false;
    }
  }

  private async startReading() {
    if (!this.port || !this.port.readable) return;

    // TextDecoder stream
    // @ts-ignore
    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    let accumulated = '';

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          accumulated += value;
          const lines = accumulated.split(/\r?\n/);
          accumulated = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.handleIncomingLine(trimmed);
            }
          }
        }
      }
    } catch (err: any) {
      this.emitLog('error', `Read stream error: ${err.message}`);
    }
  }

  private handleIncomingLine(line: string) {
    this.emitLog('received', line);

    if (line.toLowerCase() === 'ok' || line.includes('ok')) {
      if (this.state.status === 'streaming' && this.isAwaitingOk) {
        this.isAwaitingOk = false;
        this.sendNextStreamingLine();
      }
    }
  }

  public async sendRaw(text: string) {
    this.emitLog('sent', text);

    // Extract coordinates from manual commands as well (jogging, zeroing, pen tests)
    this.extractCoordinatesFromText(text);

    if (this.isVirtual) {
      // Simulate Arduino response
      setTimeout(() => {
        if (text.startsWith('?')) {
          this.emitLog('received', `<Run|MPos:${this.state.currentCoordinates.x.toFixed(2)},${this.state.currentCoordinates.y.toFixed(2)},0.00|FS:1200,0|Pn:${this.state.currentCoordinates.penDown ? 'D' : 'U'}>`);
        } else {
          this.emitLog('received', 'ok');
          if (this.state.status === 'streaming' && this.isAwaitingOk) {
            this.isAwaitingOk = false;
            this.sendNextStreamingLine();
          }
        }
      }, 25);
      return;
    }

    if (!this.port || !this.port.writable) {
      this.emitLog('error', 'Cannot send: Serial port not writable');
      return;
    }

    try {
      // @ts-ignore
      const textEncoder = new TextEncoderStream();
      this.writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();
      await this.writer.write(text.endsWith('\n') ? text : text + '\n');
      this.writer.releaseLock();
    } catch (err: any) {
      this.emitLog('error', `Send error: ${err.message}`);
    }
  }

  public startStreaming(gcodeLines: string[]) {
    if (this.state.status !== 'connected' && this.state.status !== 'paused') {
      this.emitLog('error', 'Cannot stream: Plotter is not connected');
      return;
    }

    this.streamingQueue = gcodeLines;
    this.streamingIndex = 0;
    this.isPaused = false;
    this.isAborted = false;
    this.isAwaitingOk = false;

    this.updateState({
      status: 'streaming',
      currentLineIndex: 0,
      totalLines: gcodeLines.length,
      progressPercent: 0
    });

    this.emitLog('info', `Starting plot streaming: ${gcodeLines.length} lines total`);
    this.sendNextStreamingLine();
  }

  public pauseStreaming() {
    if (this.state.status === 'streaming') {
      this.isPaused = true;
      this.updateState({ status: 'paused' });
      this.emitLog('warning', 'Plotting paused by user');
    }
  }

  public resumeStreaming() {
    if (this.state.status === 'paused') {
      this.isPaused = false;
      this.updateState({ status: 'streaming' });
      this.emitLog('info', 'Plotting resumed');
      this.sendNextStreamingLine();
    }
  }

  public abortStreaming() {
    this.isAborted = true;
    this.isPaused = false;
    this.streamingQueue = [];
    this.isAwaitingOk = false;

    // Send safe pen up and stop command
    this.sendRaw('M3 S35\nG0 X0 Y0\nM84');

    this.updateState({
      status: 'connected',
      currentLineIndex: 0,
      progressPercent: 0
    });
    this.emitLog('warning', 'Plotting aborted. Sent Emergency Stop (Pen UP, Motors OFF)');
  }

  private sendNextStreamingLine() {
    if (this.isPaused || this.isAborted) return;

    if (this.streamingIndex >= this.streamingQueue.length) {
      this.updateState({
        status: 'connected',
        progressPercent: 100
      });
      this.emitLog('info', 'Plot successfully completed!');
      return;
    }

    const line = this.streamingQueue[this.streamingIndex];
    this.streamingIndex++;

    // Parse coordinates from line for live tracker
    this.extractCoordinatesFromLine(line);

    const progress = Math.round((this.streamingIndex / this.streamingQueue.length) * 100);
    this.updateState({
      currentLineIndex: this.streamingIndex,
      progressPercent: progress
    });

    // Skip empty lines or pure comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) {
      // Immediate next line
      this.sendNextStreamingLine();
      return;
    }

    this.isAwaitingOk = true;
    this.sendRaw(trimmed);
  }

  private extractCoordinatesFromText(text: string) {
    const lines = text.split(/\r?\n/);
    let isRelativeMode = false;

    let currentX = this.state.currentCoordinates.x;
    let currentY = this.state.currentCoordinates.y;
    let penDown = this.state.currentCoordinates.penDown;

    for (const rawLine of lines) {
      const upper = rawLine.trim().toUpperCase();
      if (!upper) continue;

      if (upper.includes('G91')) {
        isRelativeMode = true;
      } else if (upper.includes('G90')) {
        isRelativeMode = false;
      }

      if (upper.includes('G92')) {
        if (upper.includes('X0')) currentX = 0;
        if (upper.includes('Y0')) currentY = 0;
      }

      const xMatch = upper.match(/X([0-9.-]+)/);
      if (xMatch) {
        const val = parseFloat(xMatch[1]);
        if (isRelativeMode) {
          currentX = Math.max(0, currentX + val);
        } else {
          currentX = val;
        }
      }

      const yMatch = upper.match(/Y([0-9.-]+)/);
      if (yMatch) {
        const val = parseFloat(yMatch[1]);
        if (isRelativeMode) {
          currentY = Math.max(0, currentY + val);
        } else {
          currentY = val;
        }
      }

      if (upper.includes('M3')) {
        const sMatch = upper.match(/S([0-9]+)/);
        if (sMatch) {
          const angle = parseInt(sMatch[1], 10);
          penDown = angle > 60;
        } else {
          penDown = true;
        }
      } else if (upper.includes('M5')) {
        penDown = false;
      }
    }

    this.updateState({
      currentCoordinates: { x: currentX, y: currentY, penDown }
    });
  }

  private extractCoordinatesFromLine(line: string) {
    this.extractCoordinatesFromText(line);
  }

  public async disconnect() {
    if (this.virtualTimer) {
      clearTimeout(this.virtualTimer);
      this.virtualTimer = null;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {}
      this.port = null;
    }

    this.updateState({
      status: 'disconnected',
      portName: 'Not Connected',
      progressPercent: 0
    });
    this.emitLog('info', 'Disconnected from serial port');
  }
}
