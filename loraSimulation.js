/**
 * =================================================================================
 * LORA P2P WIRELESS LINK SIMULATION ENGINE (loraSimulation.js)
 * Simulates RF propagation, airtime calculation, packet framing, RSSI/SNR noise,
 * and Point-to-Point communication channel between ESP32 TX and ESP32 RX.
 * =================================================================================
 */

class LoRaSimulationEngine {
  constructor() {
    this.frequency = 433.0; // MHz
    this.spreadingFactor = 7; // SF7 (SF7 - SF12)
    this.bandwidth = 125; // kHz (125, 250, 500)
    this.codingRate = "4/5"; // CR 4/5, 4/6, 4/7, 4/8
    this.txPower = 17; // dBm
    this.preambleLen = 8;
    
    this.linkConnected = true; // LoRa link connection toggle
    this.packetCounter = 1000;
    this.lastPacket = null;
  }

  /**
   * Calculates realistic LoRa Packet Airtime (Time on Air) in milliseconds
   */
  calculateAirtime(payloadSizeBytes) {
    const bwHz = this.bandwidth * 1000;
    const sf = this.spreadingFactor;
    const cr = parseInt(this.codingRate.split('/')[1]); // 5 for 4/5

    const tSymbol = (Math.pow(2, sf) / bwHz) * 1000; // ms per symbol
    const tPreamble = (this.preambleLen + 4.25) * tSymbol;

    // Payload symbol count approximation (explicit header, DE enabled for SF11/12)
    const de = (sf >= 11) ? 1 : 0;
    const header = 0; // 0 for explicit header
    const crc = 1;    // 1 for CRC enabled

    const payloadSymbCount = 8 + Math.max(
      Math.ceil((8 * payloadSizeBytes - 4 * sf + 28 + 16 * crc - 20 * header) / (4 * (sf - 2 * de))) * cr,
      0
    );

    const tPayload = payloadSymbCount * tSymbol;
    return parseFloat((tPreamble + tPayload).toFixed(2));
  }

  /**
   * Generates simulated RSSI (-dBm) and SNR (dB) with realistic path loss & fading
   */
  getSignalMetrics() {
    if (!this.linkConnected) {
      return { rssi: -125, snr: -15.0, status: 'DISCONNECTED' };
    }

    // Nominal RSSI: -72 dBm ± 3 dBm random fading
    const rssiJitter = (Math.random() - 0.5) * 6;
    const rssi = Math.round(-72 + rssiJitter);

    // Nominal SNR: +8.5 dB ± 0.8 dB jitter
    const snrJitter = (Math.random() - 0.5) * 1.6;
    const snr = parseFloat((8.5 + snrJitter).toFixed(1));

    return { rssi, snr, status: 'CONNECTED' };
  }

  /**
   * Creates a structured LoRa P2P Data Packet from sensor readings
   */
  createPacket(sensorData) {
    this.packetCounter++;

    const now = new Date();
    const timestampStr = now.toTimeString().split(' ')[0];

    const jsonPayload = {
      device_id: "TOWER_01",
      packet_id: this.packetCounter,
      tilt: sensorData.tilt,
      vibration: sensorData.vibration,
      fire: sensorData.fire,
      voltage: sensorData.voltage,
      current: sensorData.current,
      power: sensorData.power,
      status: sensorData.status,
      timestamp: timestampStr
    };

    const jsonString = JSON.stringify(jsonPayload, null, 2);
    const compactJson = JSON.stringify(jsonPayload);
    const payloadSize = compactJson.length;

    const metrics = this.getSignalMetrics();
    const airtimeMs = this.calculateAirtime(payloadSize);

    const humanReadable = `TOWER_01 | #${this.packetCounter} | ${sensorData.tilt}° | VIB:${sensorData.vibration} | FIRE:${sensorData.fire ? 'DETECTED' : 'SAFE'} | ${sensorData.voltage}V | ${sensorData.current}A | ${sensorData.power}W | ${sensorData.status}`;

    const packetObj = {
      packetId: this.packetCounter,
      timestamp: timestampStr,
      jsonPayload: jsonPayload,
      jsonString: jsonString,
      compactJson: compactJson,
      humanReadable: humanReadable,
      payloadSizeBytes: payloadSize,
      airtimeMs: airtimeMs,
      rssi: metrics.rssi,
      snr: metrics.snr,
      frequency: `${this.frequency} MHz`,
      spreadingFactor: `SF${this.spreadingFactor}`,
      bandwidth: `${this.bandwidth} kHz`,
      codingRate: this.codingRate,
      txPower: `${this.txPower} dBm`,
      status: this.linkConnected ? 'DELIVERED' : 'LOST_IN_AIR'
    };

    this.lastPacket = packetObj;
    return packetObj;
  }
}

// Export singleton instance for global web simulation
window.loraEngine = new LoRaSimulationEngine();
