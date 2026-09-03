# Allegri Diagnostic Kiosk Frontend

A lightweight React/Vite **thin client** designed to interface with a Raspberry Pi Edge AI device. The Pi handles all heavy lifting: YOLO microscope image analysis, camera streaming, and SQLite database storage. This frontend is purely a display and control surface.

---

## Architecture Notes

> **Read this before touching anything.**

### Kiosk Mode — No Authentication

This app runs in **Kiosk Mode**. All Login, Authentication, and User Profile management features have been **intentionally removed**. There is no login screen. The app boots directly into the dashboard as a hardcoded device user (`KIOSK_USER`). Do not attempt to re-add auth — it is out of scope for this deployment.

### No Local Webcam

Local laptop/desktop webcam access has been **removed**. The app exclusively uses the **Raspberry Pi's camera** via an MJPEG stream. If you see no camera feed, the issue is network connectivity to the Pi — not a browser permissions problem.

### localStorage — IP Address Only

`localStorage` is used for **one purpose only**: persisting the Pi's dynamic IP address between page refreshes (key: `PI_IP`, default: `192.168.137.47`). All actual patient data is fetched live from the Pi's SQLite database via the backend API. Nothing medical is stored in the browser.

### Backend Endpoints

| Server | Default Base URL | Purpose |
|---|---|---|
| Pi API | `http://{PI_IP}:8000` | YOLO analysis, history, health check |
| Pi Camera | `http://{PI_IP}:5000` | MJPEG live stream, frame capture |

---

## Getting Started

**Prerequisites:** Node.js 18+ and npm installed on your machine.

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Vite will print a local URL (typically `http://localhost:5173`). Open it in your browser.

---

## Connecting to the Raspberry Pi

The app needs to know where to find the Pi on your network. On first launch (or if the Pi's IP changes), do the following:

1. On the dashboard, click the **Network Settings** button (or the IP Configurator icon in the header).
2. In the input box, paste **one** of the following:
   - The Pi's **local IP address** — e.g., `192.168.137.47`
     *(Use this when your laptop and Pi are on the same Wi-Fi or Ethernet network.)*
   - A **Serveo or Pinggy tunnel URL** — e.g., `https://abc123.serveousercontent.com`
     *(Use this for remote access when you are on different networks.)*
3. Click **Save / Connect**. The page will reload and attempt to reach the Pi.

The **status indicator in the header** will turn green when the Pi is reachable (`/health` check). If it stays red, double-check the IP/URL and confirm the Pi's Flask servers are running on ports `8000` and `5000`.

---

## Project Structure

```
allegri-hospital-project/
├── App.tsx                     # Root component, view routing, state
├── index.tsx                   # ReactDOM entry point
├── types.ts                    # Shared TypeScript interfaces
├── components/
│   ├── CameraView.tsx          # Pi camera stream + batch capture workflow
│   ├── DoctorOverrideModal.tsx # Edit/correct YOLO detection results
│   ├── Header.tsx              # Logo, health status, Pi connectivity indicator
│   ├── HistoryView.tsx         # View session-local analysis results
│   ├── NetworkSettings.tsx     # Pi IP / tunnel URL configurator
│   ├── PatientHistoryView.tsx  # Fetch & browse history from Pi database
│   └── LoginForm.tsx           # [DEAD CODE — see below]
├── services/
│   ├── piConfig.ts             # Builds all API endpoint URLs from stored IP
│   └── piService.ts            # All HTTP calls to the Pi backend
└── utils/
    └── sampleNaming.ts         # Auto-generates sample label names
```

---

## Dead Code — Safe to Delete

The following file is **no longer used** anywhere in the application. It is a leftover from before the Kiosk Mode switch and can be safely deleted:

| File | Reason |
|---|---|
| `components/LoginForm.tsx` | Implements localStorage-based login/signup. Not imported or rendered anywhere. The app bypasses authentication entirely via the hardcoded `KIOSK_USER` in `App.tsx`. |

No `AuthContext` file was found — it appears to have already been removed in a prior cleanup. The `UserProfile` interface in `types.ts` is still valid (it types the `KIOSK_USER` constant) and should stay.

---

## Tech Stack

| Tool | Version |
|---|---|
| React | 19 |
| Vite | 6 |
| TypeScript | 5 |
| lucide-react | 0.556 (icons) |
| Capacitor | 8 (Android packaging — not required for local dev) |
