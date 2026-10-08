import os
from flask import Flask, jsonify, render_template

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/status")
def status():
    return jsonify({
        "system": "SALBAR",
        "backend": "online",
        "cnn": "Pi",
        "mlx90640": "Pi",
        "gps": "ESP32",
        "a7670e": "ESP32"
    })


@app.route("/api/detection")
def detection():
    return jsonify({
        "detection_mode": "REMOTE",
        "classification": "not connected",
        "human_score": 0,
        "not_human_score": 0,
        "confidence_threshold": 0.70,
        "consecutive_frames": 0,
        "required_frames": 5,
        "confirmed": False,
        "sensor": "MLX90640",
        "sensor_status": "Pi"
    })


@app.route("/api/location")
def location():
    return jsonify({
        "gps_status": "ESP32",
        "latitude": None,
        "longitude": None,
        "accuracy": None
    })


@app.route("/api/alert")
def alert():
    return jsonify({
        "cellular_status": "ESP32",
        "sms_status": "not sent"
    })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
