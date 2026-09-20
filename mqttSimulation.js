/**
 * =================================================================================
 * MQTT & HIVEMQ CLOUD SIMULATION & LIVE CLIENT ENGINE (mqttSimulation.js)
 * Supports 100% Offline Simulation Mode AND Optional Live HiveMQ Cloud WebSocket Mode.
 * =================================================================================
 */

class MqttSimulationEngine {
  constructor() {
    this.mode = 'SIMULATION'; // 'SIMULATION' or 'LIVE'
    this.wifiConnected = true;
    this.mqttConnected = true;

    // Default Connection Parameters for Live HiveMQ Cloud Mode
    this.config = {
      broker: 'dd4770b26a7d4a7291371cea6d74c060.s1.eu.hivemq.cloud',
      port: 8884, // WSS WebSockets Port
      username: 'admin',
      password: 'Pass@123',
      topicRoot: 'tower1'
    };

    this.liveClient = null; // Paho MQTT client instance if active
    this.messageLog = [];
    this.maxLogLength = 30;

    this.topics = {
      telemetry: 'tower1/telemetry',
      status: 'tower1/status',
      alert: 'tower1/alert',
      communication: 'tower1/communication'
    };
  }

  /**
   * Sets network connectivity state
   */
  setWiFiState(state) {
    this.wifiConnected = state;
    if (!state) {
      this.mqttConnected = false;
    }
  }

  setMQTTState(state) {
    if (!this.wifiConnected && state) {
      console.warn('[MQTT] Cannot connect MQTT while Wi-Fi is disconnected!');
      this.mqttConnected = false;
      return;
    }
    this.mqttConnected = state;
  }

  /**
   * Publishes telemetry packet to MQTT Broker
   */
  publishTelemetry(packetObj) {
    if (!this.wifiConnected) {
      return { success: false, reason: 'WIFI_OFFLINE' };
    }

    if (!this.mqttConnected) {
      return { success: false, reason: 'MQTT_DISCONNECTED' };
    }

    const payload = {
      device: packetObj.jsonPayload.device_id,
      pkt_id: packetObj.jsonPayload.packet_id,
      tilt_deg: packetObj.jsonPayload.tilt,
      vibration: packetObj.jsonPayload.vibration,
      fire: packetObj.jsonPayload.fire,
      voltage_v: packetObj.jsonPayload.voltage,
      current_a: packetObj.jsonPayload.current,
      power_w: packetObj.jsonPayload.power,
      status: packetObj.jsonPayload.status,
      rssi_dbm: packetObj.rssi,
      snr_db: packetObj.snr,
      published_at: new Date().toLocaleTimeString()
    };

    const payloadStr = JSON.stringify(payload);
    let targetTopic = this.topics.telemetry;

    if (packetObj.jsonPayload.status.includes('CRITICAL') || packetObj.jsonPayload.fire) {
      targetTopic = this.topics.alert;
    }

    // Record in local log
    const logItem = {
      timestamp: new Date().toLocaleTimeString(),
      topic: targetTopic,
      qos: 0,
      payload: payloadStr,
      mode: this.mode
    };

    this.messageLog.unshift(logItem);
    if (this.messageLog.length > this.maxLogLength) {
      this.messageLog.pop();
    }

    // If Live MQTT Mode is active & connected, publish via Paho WebSockets
    if (this.mode === 'LIVE' && this.liveClient && this.liveClient.isConnected()) {
      try {
        const message = new Paho.MQTT.Message(payloadStr);
        message.destinationName = targetTopic;
        this.liveClient.send(message);
      } catch (err) {
        console.error('[MQTT LIVE ERR]', err);
      }
    }

    return { success: true, topic: targetTopic, payload: payloadStr };
  }

  /**
   * Connects to Real HiveMQ Cloud Broker using Paho WebSockets Library
   */
  connectLiveMQTT(broker, port, username, password, topicRoot, onStatusCallback) {
    this.config.broker = broker || this.config.broker;
    this.config.port = parseInt(port) || this.config.port;
    this.config.username = username || '';
    this.config.password = password || '';
    if (topicRoot) {
      this.config.topicRoot = topicRoot;
      this.topics.telemetry = `${topicRoot}/telemetry`;
      this.topics.status = `${topicRoot}/status`;
      this.topics.alert = `${topicRoot}/alert`;
      this.topics.communication = `${topicRoot}/communication`;
    }

    if (typeof Paho === 'undefined') {
      onStatusCallback(false, 'Paho MQTT Library not loaded. Using Simulation fallback.');
      return;
    }

    const clientId = 'WebClient_TowerMonitor_' + Math.random().toString(16).substr(2, 8);
    this.liveClient = new Paho.MQTT.Client(this.config.broker, Number(this.config.port), clientId);

    const connectOptions = {
      useSSL: true,
      onSuccess: () => {
        this.mode = 'LIVE';
        this.mqttConnected = true;
        this.wifiConnected = true;
        try {
          this.liveClient.subscribe(`${this.config.topicRoot}/#`);
          this.liveClient.onMessageArrived = (msg) => {
            try {
              const data = JSON.parse(msg.payloadString);
              if (window.handleLiveMqttTelemetry) {
                window.handleLiveMqttTelemetry(data);
              }
            } catch(e) {
              console.error('[MQTT Parse Error]', e);
            }
          };
        } catch(subErr) {
          console.warn('[MQTT Subscribe Warn]', subErr);
        }
        onStatusCallback(true, `Connected to ${this.config.broker}:${this.config.port}`);
      },
      onFailure: (err) => {
        this.mqttConnected = false;
        onStatusCallback(false, `Connection Failed: ${err.errorMessage}`);
      }
    };

    if (this.config.username) {
      connectOptions.userName = this.config.username;
    }
    if (this.config.password) {
      connectOptions.password = this.config.password;
    }

    onStatusCallback(null, 'Connecting to Live Broker via WebSockets...');
    this.liveClient.connect(connectOptions);
  }

  disconnectLiveMQTT() {
    if (this.liveClient && this.liveClient.isConnected()) {
      this.liveClient.disconnect();
    }
    this.mode = 'SIMULATION';
    this.mqttConnected = true;
  }
}

// Export singleton instance for global web simulation
window.mqttEngine = new MqttSimulationEngine();
