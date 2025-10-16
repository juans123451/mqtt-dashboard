import express from "express";
import http from "http";
import { Server } from "socket.io";
import mqtt from "mqtt";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ------------------- CONFIGURACIÓN MQTT -------------------
const MQTT_BROKER = "mqtt://broker.emqx.io";
const MQTT_TOPIC = "esp32/sensores";

// Conectarse al broker MQTT
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log("✅ Conectado al broker MQTT");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (!err) {
      console.log(`📡 Suscrito al topic: ${MQTT_TOPIC}`);
    }
  });
});

// Cuando llegan datos desde el ESP32
client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log("📩 Datos recibidos desde ESP32:", data);
    io.emit("sensorData", data); // 🔹 Enviar datos al navegador en tiempo real
  } catch (error) {
    console.error("❌ Error procesando mensaje MQTT:", error);
  }
});

// ------------------- SERVIDOR WEB -------------------
app.use(express.static("public")); // Carpeta con tu index.html

server.listen(3000, () => {
  console.log("🚀 Servidor web en http://localhost:3000");
});
