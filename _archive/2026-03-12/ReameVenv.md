# ReameVenv.md

## What `.venv` is in this project

`.venv` is the local Python virtual environment for the backend side of this app.
It isolates Python runtime and packages used by:

- `serveur_imagerie.py` (Flask + OpenCV camera streaming/capture)
- `main.py` (FastAPI + Torch + SQLite flow)
- `server.py` (FastAPI + Torch + OpenCV inference API)

It is separate from Node/React dependencies (`node_modules`).

---

## What your current `.venv` contains (actual project values)

From `.venv/pyvenv.cfg`:

- Python home: `C:\Users\shubh\AppData\Local\Programs\Python\Python314`
- Python version: `3.14.2`
- `include-system-site-packages = false` (good isolation)
- Environment path: `D:\ALLEGRI121\allegri-hospital-project\.venv`

Top-level structure:

- `.venv\Scripts\` -> Python executable + pip + activate scripts
- `.venv\Lib\site-packages\` -> installed Python packages
- `.venv\Include\` -> C-extension headers
- `.venv\share\` -> shared package resources
- `.venv\pyvenv.cfg` -> environment metadata

---

## Key installed package groups inside `.venv`

Your environment currently includes (from `pip list`):

- API/backend: `fastapi`, `starlette`, `uvicorn`, `pydantic`
- AI/vision: `torch`, `torchvision`, `numpy`, `scipy`, `pillow`
- CV/runtime: `opencv-python`, `opencv-python-headless`
- Augmentation: `albumentations`, `albucore`
- HTTP/network: `requests`, `httpx`, `websockets`
- Supabase: `supabase`, `postgrest`, `storage3`, `supabase-auth`, `supabase-functions`

This means `.venv` is already prepared for both your local microscope server flow and model inference flow.

---

## Why `.venv` is useful here

1. Prevents dependency conflicts between this medical app and other Python projects.
2. Locks runtime behavior for AI/camera code to a known package set.
3. Keeps backend reproducible across machines when using `requirements.txt`.
4. Lets frontend (React/Capacitor) and backend (Python) evolve independently.
5. Reduces "works on my machine" issues in model/camera pipelines.

---

## How to use `.venv`

### Activate (Windows PowerShell)

```powershell
cd D:\ALLEGRI121\allegri-hospital-project
.\.venv\Scripts\Activate.ps1
python --version
pip --version
```

### Install/update backend dependencies

```powershell
pip install -r requirements.txt
```

### Run Python backends with `.venv`

```powershell
python serveur_imagerie.py
```

or

```powershell
python main.py
```

or

```powershell
python server.py
```

### Deactivate

```powershell
deactivate
```

---

## Quick verification commands

```powershell
Get-Content .\.venv\pyvenv.cfg
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip list
```

---

## Notes specific to this repo

- Your `.gitignore` currently does not ignore `.venv`.
  In most teams, `.venv/` is excluded from git to avoid huge and machine-specific commits.
- `requirements.txt` includes `opencv-python-headless`, while the environment also has `opencv-python`.
  Keep this intentional: `serveur_imagerie.py` with local camera access usually needs `opencv-python` (GUI/camera features).
- React/Capacitor (`npm`, `vite`, Android build) does not use `.venv`; only Python services do.

---

## Recommended clean setup on a new machine

```powershell
cd D:\ALLEGRI121\allegri-hospital-project
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```
