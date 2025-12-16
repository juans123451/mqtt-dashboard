// ------------------- IMPORTACIONES -------------------
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mqtt from "mqtt";
import Groq from "groq-sdk"; // Librería de Groq
require('dotenv').config(); // ← ¡Primera línea útil!

// ------------------- CONFIGURACIÓN GROQ (API KEY LOCAL) -------------------
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("❌ Error: No se encontró la API Key de Groq.");
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ------------------- CONFIGURACIÓN SERVIDOR -------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());

// ------------------- CONFIGURACIÓN MQTT -------------------
const MQTT_BROKER = "mqtt://broker.emqx.io";
const MQTT_TOPIC_SENSORES = "esp32/sensores";
const MQTT_TOPIC_LED = "esp32/led";
const MQTT_TOPIC_LED_STATUS = "esp32/led/status";
const MQTT_TOPIC_SERVO = "esp32/servo";
const MQTT_TOPIC_MOV = "mi_casa/alerta/movimiento"; // ✅ Topic del PIR (coincide con ESP32)

const client = mqtt.connect(MQTT_BROKER);

// ------------------- CONEXIÓN MQTT -------------------
client.on("connect", () => {
  console.log("✅ Conectado al broker MQTT");

  client.subscribe([MQTT_TOPIC_SENSORES, MQTT_TOPIC_LED_STATUS, MQTT_TOPIC_MOV], (err) => {
    if (err) {
      console.error("❌ Error al suscribirse a topics:", err);
    } else {
      console.log(`📡 Suscrito a: ${MQTT_TOPIC_SENSORES}, ${MQTT_TOPIC_LED_STATUS}, ${MQTT_TOPIC_MOV}`);
    }
  });
});

// ------------------- RECEPCIÓN DE MENSAJES MQTT -------------------
client.on("message", (topic, message) => {
  try {
    const msg = message.toString();

    // Datos de sensores
    if (topic === MQTT_TOPIC_SENSORES) {
      const data = JSON.parse(msg);
      console.log("📩 Datos desde ESP32:", data);
      io.emit("sensorData", data);
    }

    // Estado LED
    if (topic === MQTT_TOPIC_LED_STATUS) {
      console.log("💡 Estado del LED:", msg);
      io.emit("ledStatus", msg);
    }

    // Movimiento PIR
    if (topic === MQTT_TOPIC_MOV) {
      console.log("🚨 Movimiento PIR:", msg);
      io.emit("pirStatus", msg); // envia "1" o "0" al dashboard
    }

  } catch (error) {
    console.error("❌ Error procesando mensaje MQTT:", error);
  }
});

// ------------------- SOCKET.IO (Dashboard) -------------------
io.on("connection", (socket) => {
  console.log("🖥️ Cliente conectado al dashboard");

  // Control LED
  socket.on("ledControl", (estado) => {
    console.log(`💡 Comando LED recibido: ${estado}`);
    client.publish(MQTT_TOPIC_LED, estado);
  });

  // Control Servo
  socket.on("servoControl", (estado) => {
    console.log(`⚙️ Comando servo recibido: ${estado}`);
    client.publish(MQTT_TOPIC_SERVO, estado);
  });

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado");
  });
});

// ------------------- RUTA PARA EL CHATBOT (GROQ + LLAMA 3) -------------------
app.post("/api/chat", async (req, res) => {
  const { message, sensorData } = req.body;

  if (!message || !sensorData) {
    return res.status(400).json({ error: "Faltan datos: 'message' y 'sensorData'." });
  }

  const prompt = `
Eres un asistente agrícola experto. Analiza estos datos:

- Temperatura ambiente: ${typeof sensorData.temperatura_dht === 'number' ? sensorData.temperatura_dht.toFixed(1) : '--'} °C
- Humedad relativa: ${typeof sensorData.humedad_dht === 'number' ? sensorData.humedad_dht.toFixed(1) : '--'} %
- Distancia (tanque agua): ${typeof sensorData.distancia_cm === 'number' ? sensorData.distancia_cm.toFixed(1) : '--'} cm

Contexto:
- Humedad < 30% → sugiere regar.
- Distancia > 10 cm → tanque vacío.
- Temperatura > 30°C → abrir puerta (servomotor).

Usuario pregunta: "${message}"

Responde en 1-2 oraciones, en español, con consejos prácticos.
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 150,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "Sin respuesta.";
    res.json({ response: responseText });

  } catch (error) {
    console.error("❌ Error con Groq:", error.message);
    res.status(500).json({ error: "Error en el asistente." });
  }
});

// ------------------- SERVIDOR WEB -------------------
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💬 Chatbot activo con Groq + Llama 3`);
});