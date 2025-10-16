const socket = io();

socket.on("sensorData", (data) => {
  document.getElementById("data").innerHTML = `
    <p><b>Temperatura DHT:</b> ${data.temperatura_dht} °C</p>
    <p><b>Humedad:</b> ${data.humedad_dht} %</p>
    <p><b>Temperatura BMP:</b> ${data.temperatura_bmp} °C</p>
    <p><b>Presión:</b> ${data.presion} hPa</p>
    <p><b>Distancia:</b> ${data.distancia_cm} cm</p>
  `;
});
