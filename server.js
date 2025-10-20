// ------------------- IMPORTACIONES -------------------
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mqtt from "mqtt";

// ------------------- CONFIGURACIÓN SERVIDOR -------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ------------------- CONFIGURACIÓN MQTT -------------------
const MQTT_BROKER = "mqtt://broker.emqx.io";
const MQTT_TOPIC_SENSORES = "esp32/sensores";
const MQTT_TOPIC_LED = "esp32/led";
const MQTT_TOPIC_LED_STATUS = "esp32/led/status";
const MQTT_TOPIC_SERVO = "esp32/servo"; // Nuevo topic para servo

const client = mqtt.connect(MQTT_BROKER);

// ------------------- CONEXIÓN MQTT -------------------
client.on("connect", () => {
  console.log("✅ Conectado al broker MQTT");

  client.subscribe([MQTT_TOPIC_SENSORES, MQTT_TOPIC_LED_STATUS], (err) => {
    if (err) {
      console.error("❌ Error al suscribirse a topics:", err);
    } else {
      console.log(`📡 Suscrito a: ${MQTT_TOPIC_SENSORES} y ${MQTT_TOPIC_LED_STATUS}`);
    }
  });
});

// ------------------- RECEPCIÓN DE MENSAJES MQTT -------------------
client.on("message", (topic, message) => {
  try {
    const msg = message.toString();

    if (topic === MQTT_TOPIC_SENSORES) {
      const data = JSON.parse(msg);
      console.log("📩 Datos desde ESP32:", data);
      io.emit("sensorData", data);
    }

    if (topic === MQTT_TOPIC_LED_STATUS) {
      console.log("💡 Estado del LED:", msg);
      io.emit("ledStatus", msg);
    }

  } catch (error) {
    console.error("❌ Error procesando mensaje MQTT:", error);
  }
});

// ------------------- SOCKET.IO (Dashboard) -------------------
io.on("connection", (socket) => {
  console.log("🖥️ Cliente conectado al dashboard");

  socket.on("ledControl", (estado) => {
    console.log(`💡 Comando LED recibido: ${estado}`);
    client.publish(MQTT_TOPIC_LED, estado);
  });

  socket.on("servoControl", (estado) => {
    console.log(`⚙️ Comando servo recibido: ${estado}`);
    client.publish(MQTT_TOPIC_SERVO, estado);
  });

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado");
  });
});

// ------------------- SERVIDOR WEB -------------------
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor web corriendo en puerto ${PORT}`);
});
