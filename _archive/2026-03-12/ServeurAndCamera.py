import cv2
import threading
import time
import io
from datetime import datetime
from flask import Flask, Response, jsonify, send_file

app = Flask(__name__)

class CameraStream:
    def __init__(self, src=0):
        self.cap = cv2.VideoCapture(src, cv2.CAP_V4L2)
        self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        # Résolution Native Bresser 5MP
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 2592)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1944)
        
        self.ret, self.frame = self.cap.read()
        self.lock = threading.Lock()
        self.running = True
        self.thread = threading.Thread(target=self.update, daemon=True)
        self.thread.start()

    def update(self):
        while self.running:
            ret, frame = self.cap.read()
            if ret and frame is not None:
                with self.lock:
                    self.frame = frame
            time.sleep(0.01)

    def read(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

cam = CameraStream(src=0)

def generate_stream():
    while True:
        frame = cam.read()
        if frame is None: continue
        # Qualité 95% pour le diagnostic
        ret, jpeg = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n\r\n')
        time.sleep(0.04) # ~25 FPS

@app.route('/flux')
def video_feed():
    return Response(generate_stream(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capturer')
def capture_image():
    frame = cam.read()
    if frame is not None:
        ret, buffer = cv2.imencode('.png', frame)
        io_buf = io.BytesIO(buffer)
        return send_file(io_buf, mimetype='image/png', as_attachment=True, 
                         download_name=f'capture_{datetime.now().strftime("%H%M%S")}.png')
    return "Erreur", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)