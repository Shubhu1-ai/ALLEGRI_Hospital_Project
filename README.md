# Pi2_Project

Short description

This repository contains a frontend (Vite/React/TypeScript) and Python backend related to the Pi2_Project web app. Files of interest include `package.json`, `main.py`, and `server.py`.

Prerequisites
- Node.js (16+)
- Python 3.10+ (if you run the Python backend)

Quick start (frontend)
1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

Quick start (backend)
1. Install Python deps (if a requirements file exists):

```bash
python -m pip install -r requirements.txt
```

2. Run the backend (example):

```bash
python server.py
```

Notes
- If any dataset or model files are large (e.g. `.pth` files), consider using Git LFS for them.
- Update this README with project-specific run instructions and environment variables as needed.

Repository

https://github.com/Shubhu1-ai/Pi2_Project
# ALLEGRI Hospital Portal - Setup & Deployment Guide

This application is a specialized medical interface designed for the ALLEGRI Hospital unit. It allows technicians to capture samples via camera, perform cropping/refining, and interface with a Raspberry Pi analysis cluster for bacterial identification.

## 🚀 How to get a Public Link (Deployment)

To share this site with others, you need to "host" it. Since this is a React application, you can do this for free in about 2 minutes using **Vercel** or **Netlify**.

### Option A: Vercel (Easiest)
1.  **Create a GitHub Account**: If you don't have one, sign up at [github.com](https://github.com).
2.  **Upload your Code**: Create a "New Repository" and upload all these project files.
3.  **Link to Vercel**: Go to [vercel.com](https://vercel.com), sign in with GitHub, and click "Add New" > "Project".
4.  **Import**: Select your repository. Vercel will automatically detect it's a React app.
5.  **Deploy**: Click "Deploy". In a few seconds, you will receive a public link (e.g., `allegri-portal.vercel.app`) that you can send to anyone!

---

## 💻 Local VS Code Setup Guide

### 1. Prerequisites
*   **Node.js**: Download and install from [nodejs.org](https://nodejs.org/).
*   **VS Code**: Your primary code editor.

### 2. Project Initialization
1.  Open VS Code.
2.  Open a new terminal (`Ctrl + ~` or `Cmd + ~`).
3.  Run the following commands:
    ```bash
    npx create-react-app allegri-portal --template typescript
    cd allegri-portal
    npm install lucide-react
    ```

### 3. Copying the Files
1.  Delete everything inside the `src/` folder of your new project.
2.  Create the folders: `src/components` and `src/services`.
3.  Copy the code from this application into the corresponding files in your VS Code project.
4.  Ensure `public/index.html` is updated with the Tailwind and Google Font links provided in the `index.html` file code.

### 4. Running the App
In your terminal, run:
```bash
npm start
```
The app will open at `http://localhost:3000`.

---

## 🔬 System Functionality

### 🔐 Authentication
*   **Username**: `ALLEGRI`
*   **Password**: `ALLEGRI@123`
*   Features: Secure white input boxes, black text for visibility, and a password reveal toggle.

### 📸 Sample Acquisition (Camera)
*   Supports multiple captures at once.
*   **Manual Crop**: After capturing, enter the "Review" mode to crop specific areas of the image for better analysis.
*   **Batch Deletion**: Select multiple images and "Delete Selected" to clear them from memory.
*   **Garbage Clearing**: Using "Clear Gallery" wipes all temporary images from the device memory.

### 🧬 Calculation & Results (History)
*   **Filters**: Sort results by "Completed", "Pending", or "Failed".
*   **Data Management**: Use checkboxes to delete specific records or use "Clear All Logs" to wipe the diagnostic history.
*   **Status Indicators**: Color-coded badges with high-confidence progress bars.

### 🛠 Troubleshooting & Help
Accessed via the Profile icon in the top-right:
1.  **Camera**: Ensure permissions are granted.
2.  **Pi Connectivity**: Verify the Raspberry Pi unit is on the same network.
3.  **Sign Out**: Clears all local session data for security.

---

## 📡 Raspberry Pi Integration
To link your actual Raspberry Pi hardware:
1.  Open `src/services/piService.ts`.
2.  Locate the "REAL IMPLEMENTATION" section.
3.  Enter your Pi's internal IP address (e.g., `192.168.x.x`).
4.  The app will then send base64 image data to your Pi's Python/Flask API for processing.