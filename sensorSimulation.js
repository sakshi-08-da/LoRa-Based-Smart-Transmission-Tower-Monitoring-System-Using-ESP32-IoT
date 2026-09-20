/**
 * =================================================================================
 * SENSOR SIMULATION ENGINE (sensorSimulation.js)
 * Real-time math model for MPU6050 Tilt, SW-420 Vibration, Flame Sensor,
 * DC Voltage Sensor (0-25V), ACS712 Current Sensor, and DC Bulb Power Load.
 * =================================================================================
 */

class SensorSimulationEngine {
  constructor() {
    // Current Sensor Values (Real AC Transmission Line Project Defaults - 230V AC Indian Grid)
    this.tilt = 1.25;             // Degrees (0 - 30°)
    this.vibrationLevel = 'LOW';  // 'LOW', 'MEDIUM', 'HIGH'
    this.fireDetected = false;    // Boolean
    this.voltage = 230.0;         // Volts AC (Indian Mains 230V RMS, 50Hz)
    this.current = 0.00;          // Amperes AC (ACS712 True RMS, 0.00A idle)
    this.bulbState = false;       // Load ON/OFF
    this.noiseEnabled = false;    // Disabled by default for clean real-time stream

    // User Configurable Thresholds (Matches Flash NVS in ESP32 & Indian Grid)
    this.thresholds = {
      tiltWarn: 5.0,    // Warning > 5°
      tiltCrit: 10.0,   // Critical > 10°
      voltMin: 180.0,   // Low Volt < 180V
      voltMax: 260.0,   // Overvoltage > 260V
      currentMax: 5.0   // Overload > 5.0A
    };
  }

  /**
   * Reads and processes telemetry parameters with optional random Gaussian noise.
   */
  readTelemetry() {
    let currentTilt = this.tilt;
    let currentVolt = this.voltage;
    let currentCurr = this.bulbState ? this.current : 0.0;

    if (this.noiseEnabled) {
      // Add subtle sensor noise jitter
      const tiltJitter = (Math.random() - 0.5) * 0.1;
      const voltJitter = (Math.random() - 0.5) * 0.08;
      const currJitter = (Math.random() - 0.5) * 0.02;

      currentTilt = Math.max(0, parseFloat((currentTilt + tiltJitter).toFixed(1)));
      currentVolt = Math.max(0, parseFloat((currentVolt + voltJitter).toFixed(1)));
      currentCurr = Math.max(0, parseFloat((currentCurr + currJitter).toFixed(2)));
    }

    const power = parseFloat((currentVolt * currentCurr).toFixed(2));
    const evaluation = this.evaluateStatus(currentTilt, currentVolt, currentCurr, this.vibrationLevel, this.fireDetected);

    return {
      tilt: currentTilt,
      vibration: this.vibrationLevel,
      fire: this.fireDetected,
      voltage: currentVolt,
      current: currentCurr,
      power: power,
      bulbState: this.bulbState,
      status: evaluation.status,
      statusMessage: evaluation.reason,
      evaluation: evaluation
    };
  }

  /**
   * Centralized Threshold Logic Evaluator
   */
  evaluateStatus(tilt, voltage, current, vibration, fire) {
    if (fire) {
      return {
        status: 'CRITICAL',
        reason: 'CRITICAL: FIRE / FLAME DETECTED ON TOWER 1',
        isFire: true
      };
    }

    if (tilt >= this.thresholds.tiltCrit) {
      return {
        status: 'CRITICAL',
        reason: `CRITICAL: SEVERE TOWER TILT (${tilt}° ≥ ${this.thresholds.tiltCrit}°)`,
        isTiltCrit: true
      };
    }

    if (current >= this.thresholds.currentMax) {
      return {
        status: 'CRITICAL',
        reason: `CRITICAL: OVERCURRENT DETECTED (${current}A ≥ ${this.thresholds.currentMax}A)`,
        isCurrentFault: true
      };
    }

    if (tilt >= this.thresholds.tiltWarn) {
      return {
        status: 'WARNING',
        reason: `WARNING: TOWER TILT BREACH (${tilt}° ≥ ${this.thresholds.tiltWarn}°)`,
        isTiltWarn: true
      };
    }

    if (voltage < this.thresholds.voltMin || voltage > this.thresholds.voltMax) {
      return {
        status: 'WARNING',
        reason: `WARNING: VOLTAGE FAULT (${voltage}V Out of ${this.thresholds.voltMin}V-${this.thresholds.voltMax}V Range)`,
        isVoltFault: true
      };
    }

    if (vibration === 'HIGH' || vibration === 'MEDIUM') {
      return {
        status: 'WARNING',
        reason: `WARNING: STRUCTURAL VIBRATION (${vibration})`,
        isVibWarn: true
      };
    }

    return {
      status: 'NORMAL',
      reason: 'ALL TOWER PARAMETERS WITHIN NOMINAL LIMITS',
      isNormal: true
    };
  }

  /**
   * Sets pre-configured engineering demonstration scenarios for seminar presentation.
   */
  setPresetScenario(scenario) {
    switch (scenario) {
      case 'normal':
        this.tilt = 1.25;
        this.vibrationLevel = 'LOW';
        this.fireDetected = false;
        this.voltage = 230.0;
        this.current = 0.00;
        this.bulbState = false;
        break;

      case 'bulb_load':
        this.tilt = 1.25;
        this.vibrationLevel = 'LOW';
        this.fireDetected = false;
        this.voltage = 229.4;
        this.current = 0.42;
        this.bulbState = true;
        break;

      case 'tilt_hazard':
        this.tilt = 12.4;
        this.vibrationLevel = 'HIGH';
        this.fireDetected = false;
        this.voltage = 230.0;
        this.current = 0.00;
        this.bulbState = false;
        break;

      case 'fire_incident':
        this.tilt = 1.25;
        this.vibrationLevel = 'MEDIUM';
        this.fireDetected = true;
        this.voltage = 230.0;
        this.current = 0.00;
        this.bulbState = false;
        break;

      case 'overcurrent':
        this.tilt = 1.25;
        this.vibrationLevel = 'LOW';
        this.fireDetected = false;
        this.voltage = 215.0;
        this.current = 5.60;
        this.bulbState = true;
        break;

      case 'low_voltage':
        this.tilt = 1.25;
        this.vibrationLevel = 'LOW';
        this.fireDetected = false;
        this.voltage = 175.0;
        this.current = 0.00;
        this.bulbState = false;
        break;
    }
  }
}

// Export singleton instance for global web simulation
window.sensorEngine = new SensorSimulationEngine();
