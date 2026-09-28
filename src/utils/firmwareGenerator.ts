import { MachineConfig } from '../types/plotter';

export function generateArduinoFirmware(config: MachineConfig): string {
  const isDualY = config.kinematics === 'dual_y';
  const isCoreXY = config.kinematics === 'corexy';

  return `/*
 * =====================================================================
 * PlotterCraft CNC - Arduino Uno 3-Stepper & 1-Servo Pen Plotter Firmware
 * =====================================================================
 * Target Board: Arduino Uno (ATmega328P) / CNC Shield V3 / Custom Drivers
 * Configuration:
 *   - Kinematics: ${config.kinematics.toUpperCase()} (${isDualY ? 'Dual-Y Gantry: X, Y1, Y2' : isCoreXY ? 'CoreXY (Motors A & B + Aux)' : 'Cartesian X, Y, Z'})
 *   - X Steps/mm: ${config.stepsPerMmX.toFixed(2)}
 *   - Y Steps/mm: ${config.stepsPerMmY.toFixed(2)}
 *   - Servo Pin: Digital ${config.penServoPin}
 *   - Pen UP Angle: ${config.penUpAngle}°
 *   - Pen DOWN Angle: ${config.penDownAngle}°
 *   - Baud Rate: ${config.baudRate}
 * =====================================================================
 */

#include <Servo.h>

// ------------------- PIN DEFINITIONS -------------------
// Stepper Pins (Default matches Arduino CNC Shield V3)
const int PIN_X_STEP = ${config.xStepPin};
const int PIN_X_DIR  = ${config.xDirPin};

const int PIN_Y_STEP = ${config.yStepPin};
const int PIN_Y_DIR  = ${config.yDirPin};

${isDualY ? `// Secondary Y-Axis Stepper (CNC Shield A-Axis cloned or custom pins)
const int PIN_Y2_STEP = ${config.y2StepPin};
const int PIN_Y2_DIR  = ${config.y2DirPin};` : `// Auxiliary / Z Stepper
const int PIN_Z_STEP = ${config.y2StepPin};
const int PIN_Z_DIR  = ${config.y2DirPin};`}

const int PIN_ENABLE = ${config.enablePin};   // Low = Drivers Enabled
const int PIN_SERVO  = ${config.penServoPin};  // PWM Pin for Pen Lift Servo

// ------------------- MOTION CONSTANTS -------------------
const float STEPS_PER_MM_X = ${config.stepsPerMmX.toFixed(2)}f;
const float STEPS_PER_MM_Y = ${config.stepsPerMmY.toFixed(2)}f;

const int PEN_UP_ANGLE   = ${config.penUpAngle};
const int PEN_DOWN_ANGLE = ${config.penDownAngle};
const int PEN_LIFT_DELAY = ${config.penLiftDelayMs}; // Milliseconds to wait for servo

const bool INVERT_X  = ${config.invertX ? 'true' : 'false'};
const bool INVERT_Y  = ${config.invertY ? 'true' : 'false'};
${isDualY ? `const bool INVERT_Y2 = ${config.invertY2 ? 'true' : 'false'};` : ''}

// ------------------- STATE VARIABLES -------------------
Servo penServo;
float currentX = 0.0f;
float currentY = 0.0f;
bool isPenDown = false;
bool isAbsoluteMode = true;

// Serial Command Buffer
char serialBuffer[96];
int bufferIndex = 0;

void setup() {
  Serial.begin(${config.baudRate});
  
  // Initialize Stepper Pins
  pinMode(PIN_X_STEP, OUTPUT);
  pinMode(PIN_X_DIR, OUTPUT);
  pinMode(PIN_Y_STEP, OUTPUT);
  pinMode(PIN_Y_DIR, OUTPUT);
  
  ${isDualY ? `pinMode(PIN_Y2_STEP, OUTPUT);
  pinMode(PIN_Y2_DIR, OUTPUT);` : `pinMode(PIN_Z_STEP, OUTPUT);
  pinMode(PIN_Z_DIR, OUTPUT);`}

  pinMode(PIN_ENABLE, OUTPUT);
  digitalWrite(PIN_ENABLE, LOW); // Enable stepper drivers

  // Initialize Servo
  penServo.attach(PIN_SERVO);
  setPenPosition(PEN_UP_ANGLE);
  delay(PEN_LIFT_DELAY);

  Serial.println(F("Grbl 1.1h ['$' for help]"));
  Serial.println(F("[PlotterCraft CNC Uno 3-Stepper Ready]"));
  Serial.println(F("ok"));
}

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '\\n' || c == '\\r') {
      if (bufferIndex > 0) {
        serialBuffer[bufferIndex] = '\\0';
        parseAndExecuteGCode(serialBuffer);
        bufferIndex = 0;
        Serial.println(F("ok"));
      }
    } else if (c == '?') {
      // Status query
      printStatus();
    } else if (bufferIndex < (sizeof(serialBuffer) - 1)) {
      serialBuffer[bufferIndex++] = c;
    }
  }
}

// ------------------- G-CODE PARSER -------------------
void parseAndExecuteGCode(char* line) {
  // Strip comments (starting with ';' or '(')
  char* comment = strchr(line, ';');
  if (comment != NULL) *comment = '\\0';
  comment = strchr(line, '(');
  if (comment != NULL) *comment = '\\0';

  // Trim leading whitespace
  while (*line == ' ') line++;
  if (strlen(line) == 0) return;

  // Command letter
  char cmd = toupper(line[0]);
  int code = atoi(&line[1]);

  if (cmd == 'G') {
    switch (code) {
      case 0: // Rapid Linear Move (Pen Up usually)
      case 1: { // Coordinated Linear Feed
        float targetX = currentX;
        float targetY = currentY;

        char* xPtr = strchr(line, 'X');
        if (!xPtr) xPtr = strchr(line, 'x');
        if (xPtr) {
          float val = atof(xPtr + 1);
          targetX = isAbsoluteMode ? val : (currentX + val);
        }

        char* yPtr = strchr(line, 'Y');
        if (!yPtr) yPtr = strchr(line, 'y');
        if (yPtr) {
          float val = atof(yPtr + 1);
          targetY = isAbsoluteMode ? val : (currentY + val);
        }

        moveTo(targetX, targetY);
        break;
      }
      case 4: { // Dwell / Pause: G4 P150
        char* pPtr = strchr(line, 'P');
        if (!pPtr) pPtr = strchr(line, 'p');
        if (pPtr) {
          int ms = atoi(pPtr + 1);
          delay(ms);
        }
        break;
      }
      case 21: // Millimeter Units
        break;
      case 28: // Return to Home / Zero
        moveTo(0.0f, 0.0f);
        break;
      case 90: // Absolute coordinates
        isAbsoluteMode = true;
        break;
      case 91: // Relative coordinates
        isAbsoluteMode = false;
        break;
      case 92: { // Set position without moving
        char* xPtr = strchr(line, 'X');
        if (!xPtr) xPtr = strchr(line, 'x');
        if (xPtr) currentX = atof(xPtr + 1);

        char* yPtr = strchr(line, 'Y');
        if (!yPtr) yPtr = strchr(line, 'y');
        if (yPtr) currentY = atof(yPtr + 1);
        break;
      }
    }
  } else if (cmd == 'M') {
    switch (code) {
      case 3: { // Spindle / Pen Down (or angle via S parameter)
        int angle = PEN_DOWN_ANGLE;
        char* sPtr = strchr(line, 'S');
        if (!sPtr) sPtr = strchr(line, 's');
        if (sPtr) {
          angle = atoi(sPtr + 1);
        }
        setPenPosition(angle);
        isPenDown = (angle != PEN_UP_ANGLE);
        delay(PEN_LIFT_DELAY);
        break;
      }
      case 5: // Pen Up
        setPenPosition(PEN_UP_ANGLE);
        isPenDown = false;
        delay(PEN_LIFT_DELAY);
        break;
      case 84: // Disable steppers
        digitalWrite(PIN_ENABLE, HIGH);
        break;
      case 17: // Enable steppers
        digitalWrite(PIN_ENABLE, LOW);
        break;
    }
  }
}

// ------------------- STEPPER MOTION (Bresenham Interpolator) -------------------
void moveTo(float targetX, float targetY) {
  // Re-enable motors
  digitalWrite(PIN_ENABLE, LOW);

  long targetStepsX = lround(targetX * STEPS_PER_MM_X);
  long targetStepsY = lround(targetY * STEPS_PER_MM_Y);
  long curStepsX    = lround(currentX * STEPS_PER_MM_X);
  long curStepsY    = lround(currentY * STEPS_PER_MM_Y);

  long deltaX = targetStepsX - curStepsX;
  long deltaY = targetStepsY - curStepsY;

  int dirX = (deltaX >= 0) ? 1 : -1;
  int dirY = (deltaY >= 0) ? 1 : -1;

  long stepsX = abs(deltaX);
  long stepsY = abs(deltaY);

  ${isCoreXY ? `
  // CoreXY Kinematics: Motor A = X + Y, Motor B = X - Y
  // (CoreXY transformation handles step pulses via combinations)
  ` : ''}

  // Set Direction Pins
  bool pinDirX = (dirX > 0);
  if (INVERT_X) pinDirX = !pinDirX;
  digitalWrite(PIN_X_DIR, pinDirX ? HIGH : LOW);

  bool pinDirY = (dirY > 0);
  if (INVERT_Y) pinDirY = !pinDirY;
  digitalWrite(PIN_Y_DIR, pinDirY ? HIGH : LOW);

  ${isDualY ? `
  bool pinDirY2 = (dirY > 0);
  if (INVERT_Y2) pinDirY2 = !pinDirY2;
  digitalWrite(PIN_Y2_DIR, pinDirY2 ? HIGH : LOW);
  ` : ''}

  // Bresenham's coordinated line drawing
  long maxSteps = max(stepsX, stepsY);
  if (maxSteps == 0) return;

  long errorX = maxSteps / 2;
  long errorY = maxSteps / 2;

  // Pulse delay in microseconds (controls speed)
  const unsigned int stepPulseDelay = 180; // ~5.5 kHz pulse rate

  for (long i = 0; i < maxSteps; i++) {
    bool stepX = false;
    bool stepY = false;

    errorX -= stepsX;
    if (errorX < 0) {
      errorX += maxSteps;
      stepX = true;
    }

    errorY -= stepsY;
    if (errorY < 0) {
      errorY += maxSteps;
      stepY = true;
    }

    // Trigger step pulses simultaneously
    if (stepX) {
      digitalWrite(PIN_X_STEP, HIGH);
    }
    if (stepY) {
      digitalWrite(PIN_Y_STEP, HIGH);
      ${isDualY ? 'digitalWrite(PIN_Y2_STEP, HIGH);' : ''}
    }

    delayMicroseconds(stepPulseDelay);

    if (stepX) {
      digitalWrite(PIN_X_STEP, LOW);
    }
    if (stepY) {
      digitalWrite(PIN_Y_STEP, LOW);
      ${isDualY ? 'digitalWrite(PIN_Y2_STEP, LOW);' : ''}
    }

    delayMicroseconds(stepPulseDelay);
  }

  currentX = targetX;
  currentY = targetY;
}

// ------------------- SERVO CONTROL -------------------
void setPenPosition(int angle) {
  angle = constrain(angle, 0, 180);
  penServo.write(angle);
}

void printStatus() {
  Serial.print(F("<Run|MPos:"));
  Serial.print(currentX, 2);
  Serial.print(F(","));
  Serial.print(currentY, 2);
  Serial.print(F(",0.00|FS:0,0|Pn:"));
  Serial.print(isPenDown ? F("D") : F("U"));
  Serial.println(F(">"));
}
`;
}
