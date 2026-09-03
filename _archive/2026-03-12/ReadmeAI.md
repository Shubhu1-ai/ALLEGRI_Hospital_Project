# ReadmeAI

## Scope of this audit

You asked for:

1. Read files inside the `best/` folder.
2. Read `script.py`.
3. Build a critical AI integration guide with file purpose, connection steps, and information flow.

Result:

- `best/` was found and inspected.
- `script.py` was **not found** anywhere in this repository (`d:\ALLEGRI121\allegri-hospital-project`).

---

## What `best/` contains

`best/` is not source code; it is a serialized model artifact directory.

Top-level entries:

- `best/.format_version` -> `1`
- `best/.storage_alignment` -> `64`
- `best/byteorder` -> `little`
- `best/version` -> `3`
- `best/data.pkl` -> metadata + object graph (pickle payload)
- `best/data/` -> tensor/storage shard files (`0`..`1018`)
- `best/.data/serialization_id` -> unique serialization id

Measured stats:

- Total files in `best/` (recursive): `1025`
- Files under `best/data/`: `1019`
- Total size: `51,223,211` bytes (~48.9 MB)

This structure matches a low-level PyTorch serialization layout (metadata + raw data shards), not a normal Python package.

---

## Critical metadata extracted from `best/data.pkl`

From pickle string inspection:

- Training date: `2026-03-08T13:14:57.354400`
- Ultralytics version marker: `8.3.235`
- License marker: `AGPL-3.0 (https://ultralytics.com/license)`
- Task marker: `detect`
- Model YAML marker: `yolo11l.yaml`
- Dataset marker: `yolo_dataset_zoom_balanced/data.yaml`
- Training path marker: `runs/detect/train9/weights/last.pt`
- Save dir marker: `C:\Users\othma\Desktop\micro_org\runs\detect\train12`

Detected module markers include:

- `ultralytics.nn.modules.conv.Conv`
- `ultralytics.nn.modules.block.C3k2`
- `ultralytics.nn.modules.block.SPPF`
- `ultralytics.nn.modules.block.C2PSA`
- `ultralytics.nn.modules.head.Detect`

### Class labels found in checkpoint metadata (50)

1. Acinetobacter baumannii
2. Abiotrophia defective
3. Bacillus cereus
4. Brucella melitensis
5. Bacteroides ovatus
6. Bacteroides thetaiotaomicron
7. Bacillus thuringiensis
8. Bacteroides vulgatus
9. Canidia albicans
10. Candida auris
11. Citrobater freundii
12. Candida glabrata
13. Clostridium hastiforme
14. Cardiobacterium hominis
15. Cryptococcus neoformans
16. Candida parapsilosis
17. Corynebacterium singulare
18. Corynebacterium striatum
19. Candida tropicalis
20. Enterococcus casseliflavus
21. Enterobacter cloacae
22. Escherichia coli
23. Enterococcus faecalis
24. Enterococcus faecium
25. Eggerthella lenta
26. Fusobacterium necrophorum
27. Fusobacterium periodonticum
28. Granulicatella adiacens
29. Gemella haemolysans
30. Gemella morbillorum
31. Kocuria kristinae
32. Klebsiella oxytoca
33. Carbapenem-resistant Klebsiella pneumoniae
34. Klebsiella pneumoniae
35. Lactobacillus paracasei
36. Lactobacillus rhamnosus
37. Propionibacterium acnes
38. Pseudomonas aeruginosa
39. Parvimonas micra
40. Staphylococcus aureus
41. Salmonella. spp
42. Streptococcus constellatus
43. Staphylococcus epidermidis
44. Streptococcus gallolyticus
45. Streptococcus gordonii
46. Streptococcus mitis
47. Streptococcus equi
48. Streptococcus sanguis
49. Trichosporon asahii
50. Veillonella parvula

---

## `script.py` status

- No `script.py` exists in this repository.
- If you intended a different file (`server.py`, `main.py`, or `serveur_imagerie.py`), this document maps all three.

---

## AI-related files and what they do

### Frontend capture and result flow

- `App.tsx`
  - Root UI state controller.
  - Switches between `Microscope` and `Dashboard`.
  - Stores `AnalysisRecord[]`.

- `components/MicroscopeView.tsx`
  - Capture sources:
    - Raspberry Pi stream + `/capturer`
    - Local phone camera + zoom
    - Gallery upload
  - All sources convert to `Blob`.
  - Calls `runLocalAI(blob)`.
  - Creates analysis records and sends to `App.tsx`.

- `services/aiService.ts`
  - Current local mock AI inference (2-second simulation).
  - Returns `BacteriaResult[]`.

- `components/AnalysisDashboard.tsx`
  - Groups and displays analysis records.
  - Supports doctor edits and correction save.

- `types.ts`
  - Defines `AnalysisRecord` and `BacteriaResult` contracts.

### Backend servers

- `serveur_imagerie.py` (Flask, port 5000)
  - `/flux`: MJPEG live stream.
  - `/capturer`: captures HD frame, saves PNG, returns image bytes.
  - Current frontend is directly wired to this server.

- `main.py` (FastAPI, port 8000)
  - `/analyze` multipart-file endpoint with Faster R-CNN flow.
  - `/history` SQLite history endpoint.
  - Not wired to current frontend path.

- `server.py` (FastAPI, port 8000)
  - `/analyze` JSON base64 endpoint with Faster R-CNN flow.
  - Not wired to current frontend path.

### Model artifacts

- `best/` (inspected above)
  - Ultralytics detection checkpoint-style serialized data.
- `bestC.pth`, `best_modelD.pth`
  - Additional model weight files in repository root.

---

## Connection steps for this project

## 1) Current working path (camera capture + local mock AI)

1. Start `serveur_imagerie.py` on Raspberry Pi/host (`:5000`).
2. In app UI, set server IP in `App.tsx` input.
3. `MicroscopeView.tsx` consumes:
   - `GET /flux` for live view.
   - `POST /capturer` for HD image blob.
4. Blob enters local AI pipeline (`services/aiService.ts`).
5. Record saved in React state and shown in dashboard.

## 2) Path to use real backend inference

1. Keep capture in `MicroscopeView.tsx`.
2. Replace/extend `runLocalAI` with real `fetch` to:
   - `main.py /analyze` (multipart file), or
   - `server.py /analyze` (base64 JSON).
3. Map backend response to `BacteriaResult[]`.
4. Preserve existing `AnalysisRecord` flow to dashboard.

## 3) Path to use the `best/` artifact in production

1. Add runtime dependency on `ultralytics`.
2. Implement a dedicated inference service (FastAPI/Flask) that loads this artifact.
3. Normalize output labels/confidence/count into `BacteriaResult[]`.
4. Point frontend AI service to this real endpoint.

---

## End-to-end information flow

Capture Source (Pi stream | Phone camera | Gallery)
-> image Blob
-> AI layer (`runLocalAI` now, real backend later)
-> normalized `BacteriaResult[]`
-> `AnalysisRecord`
-> `AnalysisDashboard` review/edit/save

For Raspberry Pi source specifically:

`/flux` (preview) and `/capturer` (HD PNG bytes)
-> blob
-> AI pipeline
-> dashboard history

---

## Important risks and gaps

1. `script.py` missing: any expected training/inference script is not present in repo.
2. `best/` artifact appears tied to Ultralytics serialization internals; direct loading path is not yet wired in app/backend code.
3. Frontend currently uses mock AI (`services/aiService.ts`), so no real model inference is occurring yet.
4. Two independent FastAPI pipelines exist (`main.py`, `server.py`) with different request/response formats; one should be selected and standardized.

