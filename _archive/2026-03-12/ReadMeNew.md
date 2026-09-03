# ReadMeNew

## 1) Project Summary

ALLEGRI is a React + TypeScript + Tailwind + Capacitor Android smart client for microscope diagnostics.

Current production workflow uses:
- A **Flask Raspberry Pi camera server** (`serveur_imagerie.py`, port `5000`) for live stream and HD capture.
- A **FastAPI YOLO11 inference server** (`main.py`, port `8000`) for AI detection.
- A mobile-first frontend (`App.tsx`, `components/MicroscopeView.tsx`, `components/AnalysisDashboard.tsx`) that captures or uploads images, runs AI, and allows doctor corrections.

---

## 2) Active Architecture (Current Sprint)

```text
Android/Capacitor App (React)
   |
   |-- Pi stream + capture --> Flask server (serveur_imagerie.py :5000)
   |       |-- GET /flux       (MJPEG stream)
   |       |-- POST /capturer  (returns HD PNG binary via send_file)
   |
   |-- AI analysis ----------> FastAPI server (main.py :8000)
           |-- GET /health
           |-- POST /analyze (multipart UploadFile)
                   |
                   --> detector.py (YOLO11 + SAHI)
                           |
                           --> returns detections JSON
```

---

## 3) UI Interfaces and User Flow

## 3.1 Main Screen (`App.tsx`)
- Screen toggle:
  - `Microscope`
  - `Dashboard`
- Server IP input used for Pi camera endpoint (`:5000` style input).

## 3.2 Microscope Console (`components/MicroscopeView.tsx`)
- **Mode tabs**:
  - `Pi Stream`
  - `Phone Camera`
  - `Gallery`
- **System status badge** (top corner):
  - Green: `System Online`
  - Red: `Microscope Disconnected`
  - On mount, component pings `GET /health`.

### Mode 1: Pi Stream
- Live `<img>` viewfinder from `http://<PI_IP>:5000/flux`
- `Capture HD from Raspberry Pi` calls `POST /capturer`
- Receives binary image Blob from Flask `send_file`

### Mode 2: Phone Camera
- Uses `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`
- If supported, zoom slider uses track capabilities and `applyConstraints({ advanced: [{ zoom }] })`
- Captures frame via hidden `<canvas>` to Blob

### Mode 3: Gallery
- Hidden file input (`accept="image/*"`) for manual upload
- Selected file enters same Blob pipeline

### Unified Blob Pipeline
- All modes produce a Blob and call `runLocalAI(blob)` from `services/aiService.ts`
- Local preview URL is created with `URL.createObjectURL(blob)`
- **Memory safety** is enforced with `URL.revokeObjectURL(...)` when replaced/discarded/unmounted

## 3.3 Results Dashboard (`components/AnalysisDashboard.tsx`)
- Groups records by date labels:
  - `Today`, `Yesterday`, or formatted date
- Info modal shows:
  - Exact timestamp
  - Generated filename
- Medical table view for bacteria results
- Doctor edit mode:
  - Add row
  - Delete row
  - Edit Name / Count / Accuracy%
  - Save corrected analysis to state (`IsEditedByDoctor = true`)

---

## 4) API Interfaces (Backend Contracts)

## 4.1 Flask Pi Camera API (`serveur_imagerie.py`)

### `GET /flux`
- Returns multipart MJPEG stream (`multipart/x-mixed-replace`)

### `POST /capturer` (also accepts GET)
- Captures one HD frame
- Saves PNG to `stockage/echantillon_<timestamp>.png`
- Returns actual PNG bytes using Flask `send_file(...)`
- Adds response header: `X-Generated-Filename`

## 4.2 FastAPI AI API (`main.py`)

### `GET /health`
Returns:
```json
{"status":"online","ai_model":"YOLO11"}
```

### `POST /analyze`
- Content-Type: `multipart/form-data`
- Field: `file` (image)
- Backend flow:
  1. Save temporary image file
  2. Call `detect_microorganisms(...)` from `detector.py`
  3. Normalize response schema
  4. Remove temp image in `finally`

Returns JSON:
```json
{
  "image_path": "...",
  "num_detections": 0,
  "inference_time_ms": 0.0,
  "used_sahi": true,
  "detections": [
    {
      "detection_id": 0,
      "box": [x1, y1, x2, y2],
      "confidence": 0.92,
      "class_id": 1,
      "class_name": "..."
    }
  ]
}
```

---

## 5) YOLO11 Integration Updates Completed

1. Removed legacy artifacts:
- `bestC.pth`
- `best_modelD.pth`
- `server.py`

2. Standardized AI backend on FastAPI (`main.py`):
- Added `/analyze` + `/health`
- Added CORS allow-all for mobile connectivity
- Added robust temp-file cleanup

3. `detector.py` compatibility hardening:
- If direct import fails, backend parses notebook-style JSON content and loads `detect_microorganisms` dynamically

4. Model packaging hardening:
- Supports extracted model directory (`best/`)
- Auto-repacks to `.generated-models/best.pt` when needed

5. Frontend AI refactor (`services/aiService.ts`):
- Removed mock delay behavior
- Sends real multipart request to `VITE_PI_SERVER_URL + /analyze`
- Maps YOLO detections to frontend `BacteriaResult[]`:
  - `Name` from `class_name`
  - `Count` from grouped detections
  - `AccuracyPercentage` from averaged `confidence`

6. Health visibility in UI:
- Added live backend status badge in `MicroscopeView.tsx`

7. Environment template added:
- `.env.example` with `VITE_PI_SERVER_URL=http://<PI_IP>:8000`

---

## 6) Frontend Data Interfaces (`types.ts`)

## `BacteriaResult`
- `Name: string`
- `Count: number`
- `AccuracyPercentage: number`

## `AnalysisRecord`
- `ID: string`
- `ImageURL: string`
- `Timestamp: string`
- `DateGroup: string`
- `Results: BacteriaResult[]`
- `IsEditedByDoctor: boolean`
- `GeneratedFilename: string`

---

## 7) Packages in Use

## 7.1 Python (`requirements.txt`)
- `ultralytics>=8.0.0` (YOLO11 inference)
- `pillow>=9.0.0` (image handling)
- `numpy>=1.20.0` (array operations)
- `opencv-python>=4.5.0` (camera/image I/O)
- `sahi>=0.11.0` (sliced inference helper)
- `torch>=2.0.0` (deep learning runtime)
- `torchvision>=0.15.0` (vision utilities/models)
- `fastapi` (AI API server)
- `uvicorn` (ASGI runtime)
- `python-multipart` (file upload parsing)

## 7.2 Frontend (`package.json`)
- `react`, `react-dom`
- `lucide-react` (icons)
- `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/filesystem`
- Dev: `vite`, `typescript`, `@vitejs/plugin-react`, `@types/node`

---

## 8) Environment Configuration

Create `.env` from `.env.example`:

```env
VITE_PI_SERVER_URL=http://<PI_IP>:8000
```

Notes:
- `VITE_PI_SERVER_URL` is used by frontend AI service and health checks.
- Android manifest already allows cleartext and includes camera/internet permissions.

---

## 9) Run Instructions

## 9.1 AI Backend (FastAPI + YOLO11)
```bash
cd allegri-hospital-project
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe main.py
```

Runs on `http://0.0.0.0:8000`.

## 9.2 Pi Camera Backend (Flask)
```bash
cd allegri-hospital-project
.\.venv\Scripts\python.exe serveur_imagerie.py
```

Runs on `http://0.0.0.0:5000`.

## 9.3 Frontend
```bash
cd allegri-hospital-project
npm install
npm run dev
```

For production build:
```bash
npm run build
```

---

## 10) End-to-End Workflow (Operational)

1. Launch Flask camera server (`:5000`).
2. Launch FastAPI AI server (`:8000`).
3. Launch frontend app.
4. On Microscope screen, status badge checks `/health`.
5. User captures image from Pi stream, phone camera, or gallery.
6. Blob enters unified pipeline.
7. Frontend sends Blob to `/analyze`.
8. YOLO11 returns detections.
9. Frontend maps detections to `BacteriaResult[]`.
10. Record is stored and shown in dashboard.
11. Doctor can edit and save corrected results.

---

## 11) Important Implementation Notes

- `detector.py` is notebook-style JSON content; backend handles this automatically.
- Extracted model folders are repacked to `.generated-models/best.pt` for compatibility.
- URL object cleanup is implemented to reduce mobile memory pressure.
- Legacy files/components still exist in repository but are not part of the current primary workflow.

