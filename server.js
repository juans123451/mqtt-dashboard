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
const MQTT_TOPIC_LED = "esp32/led";          // 🔹 Publica comandos al ESP32
const MQTT_TOPIC_LED_STATUS = "esp32/led/status"; // 🔹 (Opcional) Estado real del LED

const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log("✅ Conectado al broker MQTT");

  client.subscribe([MQTT_TOPIC_SENSORES, MQTT_TOPIC_LED_STATUS], (err) => {
    if (!err) {
      console.log(`📡 Suscrito a: ${MQTT_TOPIC_SENSORES} y ${MQTT_TOPIC_LED_STATUS}`);
    } else {
      console.error("❌ Error al suscribirse a topics:", err);
    }
  });
});

// ------------------- RECEPCIÓN DE MENSAJES MQTT -------------------
client.on("message", (topic, message) => {
  try {
    const msg = message.toString();

    // 🔸 Datos de sensores
    if (topic === MQTT_TOPIC_SENSORES) {
      const data = JSON.parse(msg);
      console.log("📩 Datos desde ESP32:", data);
      io.emit("sensorData", data);
    }

    // 🔸 Estado del LED
    if (topic === MQTT_TOPIC_LED_STATUS) {
      console.log("💡 Estado del LED:", msg);
      io.emit("ledStatus", msg); // Reenviamos al navegador
    }

  } catch (error) {
    console.error("❌ Error procesando mensaje MQTT:", error);
  }
});

// ------------------- CONTROL DESDE EL DASHBOARD -------------------
io.on("connection", (socket) => {
  console.log("🖥️ Cliente conectado al dashboard");

  // Escuchar clicks de botones desde el navegador
  socket.on("ledControl", (estado) => {
    console.log(`💡 Comando LED recibido desde dashboard: ${estado}`);
    client.publish(MQTT_TOPIC_LED, estado); // Envía al ESP32 vía MQTT
  });

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado");
  });
});

// ------------------- SERVIDOR WEB -------------------
app.use(express.static("public")); // Tu carpeta con index.html

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor web corriendo en puerto ${PORT}`);
});
