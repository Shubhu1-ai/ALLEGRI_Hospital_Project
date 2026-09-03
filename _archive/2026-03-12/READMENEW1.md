# ALLEGRI Hospital Project - Technical README (READMENEW)

This document explains the current implementation by analyzing the project files, with focus on:
- Interface workflow
- Buttons/actions
- AI analysis flow
- How results are shown
- Important code sections
- Dependencies

## 1) Project Architecture

The project is a React + TypeScript frontend with optional Python AI backends.

- Frontend entry: `index.tsx` -> `App.tsx`
- UI components: `components/`
- Analysis service layer: `services/piService.ts`
- Shared types: `types.ts`
- Backend options:
  - `main.py` (FastAPI + SQLite + PyTorch)
  - `server.py` (FastAPI + OpenCV + object detection + annotated image response)
- Mobile packaging: Capacitor (`capacitor.config.ts`, `android/`)

## 2) File-by-File (Important Files)

### Frontend Core

1. `index.tsx`
- Mounts React app into `#root`.
- Runs `<App />` in `React.StrictMode`.

2. `App.tsx`
- Central state and navigation via `ViewState` enum:
  - `LOGIN`, `DASHBOARD`, `CAMERA`, `HISTORY`, `PROFILE`
- User and history state:
  - `user: UserProfile | null`
  - `analysisHistory: AnalysisResult[]`
- Per-user local storage:
  - Load key: `HISTORY_${user.username}`
  - Save key: `HISTORY_${user.username}`
- Routes render logic between `LoginForm`, `CameraView`, `HistoryView`, and profile/dashboard screens.

3. `types.ts`
- Defines core contracts:
  - `UserProfile`
  - `AnalysisResult`
  - `PiResponse`
- `AnalysisResult` includes:
  - `bacteriaType`, `confidence`, `status`
  - optional `predictions[]` for top classes

4. `index.html`
- Loads Tailwind via CDN.
- Loads Google Font (Inter).
- Imports app module `/index.tsx`.

### UI Components

5. `components/LoginForm.tsx`
- Supports both:
  - Login mode
  - Signup mode
- Stores users in LocalStorage key `ALLEGRI_USERS`.
- Enforces max 10 users.
- Password show/hide button.
- Form validation + error/success messages.

6. `components/Header.tsx`
- Sticky top header with logo and profile entry.
- Displays logged-in user name and department.

7. `components/CameraView.tsx`
- Camera capture and gallery workflow.
- Uses browser camera (`getUserMedia`) with environment-facing camera.
- Supports pinch/slider zoom.
- Captures frames via hidden canvas (`toDataURL`).
- Attempts device save with Capacitor Filesystem; fallback to browser download.
- Review mode features:
  - select/deselect samples
  - crop sample with custom crop modal
  - per-image delete/download/correction toggle
  - batch delete / clear gallery
  - analyze selected or process all

8. `components/HistoryView.tsx`
- Shows analysis cards with:
  - image
  - bacteria type
  - confidence bar
  - timestamp
  - status badge (`completed`, `pending`, `failed`)
  - prediction list
- Filter tabs:
  - all/completed/pending/failed
- Selection and deletion:
  - select records
  - delete selected
  - clear all records
- Viewer modal:
  - larger image
  - editable predictions
  - save prediction edits back into app state

### Service / AI Integration Layer

9. `services/piService.ts`
- Export: `analyzeImageWithPi(imageBase64)`
- Current default behavior is **mock inference**:
  - random delay
  - random failure/pending probabilities
  - random bacteria labels and top-3 predictions
- Contains commented example for real fetch call to Pi backend (`/api/analyze`).

### Python Backends

10. `main.py`
- FastAPI backend with endpoint:
  - `POST /analyze` (file upload)
  - `GET /history` (SQLite records)
- Loads Faster R-CNN model and runs inference.
- Saves each result to `allegri_hospital.db`.
- Returns id/label/confidence/timestamp.

11. `server.py`
- FastAPI backend with endpoint:
  - `POST /analyze` (expects JSON `{ image: "data:image/...base64" }`)
- Decodes base64 image, runs detection, draws bounding boxes with OpenCV, returns:
  - `id`
  - `bacteriaType` summary
  - fixed `confidence: 85.0`
  - `imageProcessed` (base64 without header)

### Build / Platform Config

12. `package.json`
- Scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run preview`

13. `requirements.txt`
- Python runtime dependencies (FastAPI, PyTorch CPU wheels, OpenCV, Pillow, etc.).

14. `vite.config.ts`
- Vite server on HTTPS, host `0.0.0.0`, port `3000`.
- React plugin + basic SSL plugin.
- Defines `process.env.GEMINI_API_KEY` placeholders.

15. `capacitor.config.ts`
- Capacitor app id/name and web build folder (`dist`).

## 3) Interface Workflow (User Journey)

1. App Launch
- `index.tsx` mounts app.
- `App.tsx` starts at `LOGIN`.

2. Login / Signup
- User can create account or sign in (`LoginForm`).
- On successful login, app moves to `DASHBOARD`.

3. Dashboard
- Primary actions:
  - `Capture Sample` -> opens camera module
  - `Calculation & Results` -> opens history/results
- Secondary:
  - `System Preferences & Profile`

4. Camera Module (`camera` mode)
- Live camera preview.
- Capture button stores frame in local gallery.
- Review shortcut appears when at least one sample exists.

5. Gallery Review (`review` mode)
- Select/Deselect samples.
- Optional manual crop.
- Delete selected / clear all.
- Analyze:
  - `Analyze Selected`
  - `Process Entire Gallery`

6. AI Analysis to Results
- `CameraView` calls `analyzeImageWithPi` for each chosen image.
- Results are returned as `AnalysisResult[]`.
- `App.tsx` appends them to history and switches to `HISTORY`.

7. History / Results
- Card-based result display with status/confidence/time.
- Filter by status.
- Open viewer for full image and editable prediction rows.
- Delete selected or clear all logs.

8. Profile / Help
- System troubleshooting accordion.
- Contact support card.
- Sign out button resets in-memory session and returns to login.

## 4) Buttons and What They Do

### Dashboard Buttons (`App.tsx`)
- `Capture Sample` -> `setView(CAMERA)`
- `Calculation & Results` -> `setView(HISTORY)`
- `System Preferences & Profile` -> `setView(PROFILE)`

### Login Buttons (`LoginForm.tsx`)
- `Sign In` -> validates against `ALLEGRI_USERS`
- `Create Account` -> creates and stores new user
- Eye icon -> toggle password visibility
- Mode toggle -> switch login/signup form

### Camera Buttons (`CameraView.tsx`)
- Back arrow -> return dashboard
- Capture circle -> take photo
- Review thumbnail/check button -> open review mode
- Select All / Deselect All
- Throw to Garbage (selected)
- Empty Gallery (all)
- Crop button per image
- Correction toggle per image
- Download per image
- Delete per image
- `Analyze Selected`
- `Process Entire Gallery`

### History Buttons (`HistoryView.tsx`)
- Back arrow -> return dashboard
- Filter tabs: all/completed/pending/failed
- Select current / clear selection
- Selected Delete
- Remove All
- Correction toggle on image
- Download image
- Viewer modal close
- Edit/Save/Cancel prediction rows

### Profile Buttons (`App.tsx` profile view)
- `System Troubleshooting` expand/collapse
- `Sign Out System`
- `Return to Dashboard`

## 5) AI Flow and Analysis Pipeline

## A) Current Active Frontend Flow

1. Image capture from camera as base64 data URL.
2. `handleBatchAnalyze()` in `CameraView.tsx` runs:
   - `Promise.all(images.map(analyzeImageWithPi))`
3. `services/piService.ts` currently returns mocked `AnalysisResult`.
4. Results passed to `onAnalysisComplete`.
5. `App.tsx` stores and renders results in history.

## B) Real Backend Option (if integrated)

- `main.py`: expects multipart file upload.
- `server.py`: expects JSON with base64 `image`.
- Frontend real API call in `piService.ts` is currently commented and must be aligned to one backend format.

## 6) How Results Are Displayed

In `HistoryView.tsx`, each `AnalysisResult` card shows:
- Status badge (color + icon)
- Predicted bacteria name (`bacteriaType`)
- Confidence progress bar + percentage
- Timestamp formatted with `toLocaleDateString` / `toLocaleTimeString`
- Optional top prediction list (`predictions[]`)
- Thumbnail image and viewer modal

In viewer modal:
- Full sample image
- Editable prediction rows (`name`, `confidence`)
- Save action updates parent result using `onUpdateResult`

## 7) Data Persistence

LocalStorage keys used:
- `ALLEGRI_USERS` -> saved registered users
- `HISTORY_<username>` -> per-user analysis history

Sign-out behavior:
- Clears in-memory app state only.
- Persisted localStorage data remains available for next login.

## 8) Dependencies

### Frontend (`package.json`)
- `react`, `react-dom`
- `lucide-react`
- `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/filesystem`
- Dev: `vite`, `typescript`, `@vitejs/plugin-react`, `@vitejs/plugin-basic-ssl`

### Backend (`requirements.txt`)
- API: `fastapi`, `uvicorn[standard]`, `python-multipart`, `pydantic`
- AI/Data: `torch`, `torchvision`, `numpy`, `opencv-python-headless`, `albumentations`, `Pillow`
- Utilities: `supabase`, `python-dotenv`, `requests`, `aiohttp`

## 9) Important Code Snippets

### Per-user history storage (`App.tsx`)
```ts
const storageKey = `HISTORY_${user.username}`;
localStorage.setItem(storageKey, JSON.stringify(analysisHistory));
```

### Batch analysis execution (`components/CameraView.tsx`)
```ts
const promises = imagesToProcess.map(img => analyzeImageWithPi(img.url));
const results = await Promise.all(promises);
onAnalysisComplete(results);
```

### History card filtering (`components/HistoryView.tsx`)
```ts
const filteredResults = useMemo(() => {
  if (filter === 'all') return results;
  return results.filter(result => result.status === filter);
}, [results, filter]);
```

### Mock top-3 prediction generation (`services/piService.ts`)
```ts
const top3 = shuffled.slice(0, 3).map((name, idx) => ({ name, confidence: ... }));
return { bacteriaType: top.name, predictions: top3, status: 'completed', ... };
```

## 10) Notes / Gaps Identified

- Frontend currently uses mock AI responses by default.
- There are two backend implementations with different request/response shapes:
  - `main.py` uses file upload
  - `server.py` uses base64 JSON
- Real integration requires selecting one backend contract and updating `services/piService.ts` accordingly.
- `src/services/` directory exists but is empty; active service file is `services/piService.ts` at root-level.

## 11) Run Instructions

### Frontend
```bash
npm install
npm run dev
```

### Backend (example)
```bash
python -m pip install -r requirements.txt
python server.py
```

or

```bash
python main.py
```

