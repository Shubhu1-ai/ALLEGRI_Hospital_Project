import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Images,
  LoaderCircle,
  Microscope,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { analyzeImageWithPi } from '../services/piService';
import { PI_CAMERA_CAPTURE_URL, PI_CAMERA_STREAM_URL } from '../services/piConfig';
import { AnalysisResult } from '../types';
import { generateNextSampleName } from '../utils/sampleNaming';

interface CameraViewProps {
  onBack: () => void;
  onAnalysisComplete: (results: AnalysisResult[]) => void;
  existingSampleNames: string[];
}

type SourceMode = 'pi' | 'gallery';
type Step = 'capture' | 'review';

interface BatchImage {
  id: string;
  name: string;
  url: string;
  source: SourceMode;
  selected: boolean;
  file?: File;
  rawCaptureDataUrl?: string;
  originalImageUrl?: string;
}

interface LightboxItem {
  url: string;
  name: string;
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') { resolve(reader.result); return; }
      reject(new Error('Failed to decode captured image.'));
    };
    reader.onerror = () => reject(new Error('Failed to read captured image.'));
    reader.readAsDataURL(blob);
  });

const fileToDataUrl = (file: File): Promise<string> => blobToDataUrl(file);

const fetchImageUrlToDataUrl = async (imageUrl: string): Promise<string> => {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to load original image (${response.status}).`);
  return blobToDataUrl(await response.blob());
};

const resolveAnalysisPayload = async (item: BatchImage): Promise<string> => {
  if (item.file) return fileToDataUrl(item.file);
  if (typeof item.originalImageUrl === 'string' && item.originalImageUrl.trim().length > 0) {
    return fetchImageUrlToDataUrl(item.originalImageUrl);
  }
  if (typeof item.rawCaptureDataUrl === 'string' && item.rawCaptureDataUrl.trim().length > 0) {
    return item.rawCaptureDataUrl;
  }
  throw new Error(`No raw image source is available for ${item.name}.`);
};

const CameraView: React.FC<CameraViewProps> = ({ onBack, onAnalysisComplete, existingSampleNames }) => {
  const [step, setStep] = useState<Step>('capture');
  const [sourceMode, setSourceMode] = useState<SourceMode>('pi');
  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [piStreamError, setPiStreamError] = useState(false);

  // Lightbox
  const [lightboxItem, setLightboxItem] = useState<LightboxItem | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCount = useMemo(() => batchImages.filter((item) => item.selected).length, [batchImages]);

  // ─── Lightbox helpers ────────────────────────────────────────────────────

  const openLightbox = (item: LightboxItem) => {
    setLightboxItem(item);
    setLightboxZoom(1);
  };

  const closeLightbox = () => {
    setLightboxItem(null);
    setLightboxZoom(1);
  };

  const zoomIn = () => setLightboxZoom((z) => Number(Math.min(4, z + 0.25).toFixed(2)));
  const zoomOut = () => setLightboxZoom((z) => Number(Math.max(1, z - 0.25).toFixed(2)));

  // ─── Batch image helpers ─────────────────────────────────────────────────

  const addBatchImage = useCallback((batchImage: Omit<BatchImage, 'id' | 'name' | 'selected'>, preferredName?: string) => {
    const id = createId();
    setEnteringIds((prev) => new Set(prev).add(id));
    setBatchImages((prev) => {
      const globalNames = [...existingSampleNames, ...prev.map((item) => item.name)];
      const nextName = preferredName ?? generateNextSampleName(globalNames);
      return [...prev, { ...batchImage, id, name: nextName, selected: true }];
    });
    window.setTimeout(() => {
      setEnteringIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 40);
  }, [existingSampleNames]);

  const deleteImageWithAnimation = (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setBatchImages((prev) => prev.filter((item) => item.id !== id));
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 260);
  };

  const toggleSelection = (id: string) => {
    setBatchImages((prev) => prev.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const setAllSelections = (selected: boolean) => {
    setBatchImages((prev) => prev.map((item) => ({ ...item, selected })));
  };

  // ─── Pi capture / gallery ────────────────────────────────────────────────

  const captureFromPiStream = async () => {
    try {
      const response = await fetch(PI_CAMERA_CAPTURE_URL, { method: 'POST' });
      if (!response.ok) {
        let reason = `Pi capture request failed with HTTP ${response.status}.`;
        try {
          const payload = (await response.json()) as { message?: string; detail?: string };
          reason = payload.message ?? payload.detail ?? reason;
        } catch { /* keep HTTP fallback */ }
        throw new Error(reason);
      }
      const frameBlob: Blob = await response.blob();
      if (frameBlob.size === 0) throw new Error('Captured Pi frame was empty.');
      const frameDataUrl = await blobToDataUrl(frameBlob);
      addBatchImage({ url: frameDataUrl, source: 'pi', rawCaptureDataUrl: frameDataUrl });
      setError(null);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Capture image failed.');
    }
  };

  const openGallery = () => { galleryInputRef.current?.click(); };

  const handleGallerySelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;
    const files: File[] = Array.from(fileList as FileList);
    event.target.value = '';
    if (files.length === 0) return;

    const createdAt = Date.now();
    const reservedNames: string[] = [];
    const baseNames = [...existingSampleNames, ...batchImages.map((item) => item.name)];
    const galleryItems: BatchImage[] = files.map((file) => {
      const id = createId();
      const name = generateNextSampleName([...baseNames, ...reservedNames]);
      reservedNames.push(name);
      return { id, name, url: URL.createObjectURL(file), source: 'gallery', selected: true, file };
    });
    const newIds = galleryItems.map((item) => item.id);
    setEnteringIds((prev) => new Set([...prev, ...newIds]));
    setBatchImages((prev) => [...prev, ...galleryItems]);
    setError(null);
    window.setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.delete(id));
        return next;
      });
    }, Math.max(40, Math.min(260, Date.now() - createdAt + 40)));
  };

  // ─── Analysis ────────────────────────────────────────────────────────────

  const runAnalysis = async (analyzeSelectedOnly: boolean) => {
    const targets = analyzeSelectedOnly ? batchImages.filter((item) => item.selected) : batchImages;
    if (targets.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const results = await Promise.all(
        targets.map(async (item) => analyzeImageWithPi(await resolveAnalysisPayload(item), { imageName: item.name })),
      );
      onAnalysisComplete(results);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Batch analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── LIGHTBOX ─────────────────────────────────────────────────────────────

  const renderLightbox = () => {
    if (!lightboxItem) return null;
    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-slate-950/95 backdrop-blur-sm"
        onKeyDown={(e) => { if (e.key === 'Escape') closeLightbox(); }}
      >
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-3">
          <p className="truncate text-sm font-bold text-white">{lightboxItem.name}</p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={lightboxZoom <= 1}
              title="Zoom out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ZoomOut size={18} />
            </button>

            <span className="min-w-[3rem] text-center text-xs font-black text-slate-300">
              {Math.round(lightboxZoom * 100)}%
            </span>

            <button
              type="button"
              onClick={zoomIn}
              disabled={lightboxZoom >= 4}
              title="Zoom in"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ZoomIn size={18} />
            </button>

            <button
              type="button"
              onClick={() => setLightboxZoom(1)}
              disabled={lightboxZoom === 1}
              className="ml-1 rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={closeLightbox}
              title="Close (Esc)"
              className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-rose-500"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable image area */}
        <div className="flex-1 overflow-auto p-4">
          <img
            src={lightboxItem.url}
            alt={lightboxItem.name}
            style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'top left' }}
            className="block h-auto max-w-full transition-transform duration-150"
            draggable={false}
          />
        </div>
      </div>
    );
  };

  // ─── STEP 1: CAPTURE ──────────────────────────────────────────────────────

  const renderCaptureStep = () => (
    <section className="mx-auto w-full max-w-4xl p-4 pb-10 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-200">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">1</span>
            <h2 className="text-xl font-black tracking-tight text-slate-800">Capture Samples</h2>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Add images from the Pi camera or your device. Then proceed to review.</p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-black text-white">Step 1 of 2</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-400">Step 2 of 2</span>
        </div>
      </div>

      {/* Source toggle */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setSourceMode('pi')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${
            sourceMode === 'pi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/70'
          }`}
        >
          <Microscope size={15} />
          Live Camera
        </button>
        <button
          type="button"
          onClick={() => setSourceMode('gallery')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${
            sourceMode === 'gallery' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/70'
          }`}
        >
          <Upload size={15} />
          Upload Photos
        </button>
      </div>

      {/* Source panel */}
      {sourceMode === 'pi' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            Connected to Raspberry Pi live feed: `{PI_CAMERA_STREAM_URL}`
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
            <img
              src={PI_CAMERA_STREAM_URL}
              alt="Raspberry Pi live microscope stream"
              onError={() => setPiStreamError(true)}
              onLoad={() => setPiStreamError(false)}
              className="h-[44vh] min-h-[240px] w-full object-cover"
            />
          </div>
          {piStreamError && (
            <p className="mt-2 text-xs text-rose-600">Unable to load MJPEG stream from `{PI_CAMERA_STREAM_URL}`.</p>
          )}
          <button
            type="button"
            onClick={() => { void captureFromPiStream(); }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.99]"
          >
            <Microscope size={18} />
            Capture Frame
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div
            onClick={openGallery}
            className="flex h-[44vh] min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50"
          >
            <Images size={44} className="mb-3 text-slate-400" />
            <p className="text-base font-bold text-slate-800">Click to Upload Images</p>
            <p className="mt-1 text-sm text-slate-500">JPG, PNG — multiple files supported</p>
          </div>
          <button
            type="button"
            onClick={openGallery}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.99]"
          >
            <Upload size={18} />
            Select Images
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Staged thumbnails — images are clickable for lightbox */}
      {batchImages.length > 0 && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">
              Staged Samples
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                {batchImages.length}
              </span>
            </p>
            <button
              onClick={() => {
                const ids = batchImages.map((item) => item.id);
                setDeletingIds(new Set(ids));
                window.setTimeout(() => { setBatchImages([]); setDeletingIds(new Set()); }, 260);
              }}
              className="text-xs font-bold text-rose-600 hover:underline"
            >
              Clear All
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {batchImages.map((item) => (
              <div
                key={item.id}
                className={`relative flex-none overflow-hidden rounded-xl border border-slate-200 transition-all duration-300 ${
                  deletingIds.has(item.id) ? 'scale-90 opacity-0' : enteringIds.has(item.id) ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                }`}
              >
                {/* Click image → lightbox */}
                <button
                  type="button"
                  onClick={() => openLightbox({ url: item.url, name: item.name })}
                  className="group relative block"
                  title="Click to enlarge"
                >
                  <img src={item.url} alt={item.name} className="h-20 w-20 object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition group-hover:bg-slate-900/30">
                    <ZoomIn size={18} className="text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteImageWithAnimation(item.id)}
                  className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white transition hover:bg-rose-600"
                >
                  <Trash2 size={11} />
                </button>
                <p className="truncate bg-white px-1.5 py-1 text-[10px] font-bold text-slate-700">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proceed CTA */}
      <div className="mt-6">
        <button
          type="button"
          disabled={batchImages.length === 0}
          onClick={() => { setError(null); setStep('review'); }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review {batchImages.length > 0 ? `${batchImages.length} Sample${batchImages.length === 1 ? '' : 's'}` : 'Samples'} Before Analysis
          <ArrowRight size={18} />
        </button>
        {batchImages.length === 0 && (
          <p className="mt-2 text-center text-xs text-slate-400">Capture or upload at least one image to continue.</p>
        )}
      </div>
    </section>
  );

  // ─── STEP 2: REVIEW ───────────────────────────────────────────────────────

  const renderReviewStep = () => (
    <section className="mx-auto w-full max-w-6xl p-4 pb-32 sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => { setError(null); setStep('capture'); }}
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-200"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[11px] font-black text-white">1</span>
            <span className="text-xs font-bold text-slate-400">Capture</span>
            <ArrowRight size={13} className="text-slate-300" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">2</span>
            <h2 className="text-xl font-black tracking-tight text-slate-800">Review & Analyse</h2>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Click any image to enlarge. Toggle selection, then run analysis.
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-400">Step 1 of 2</span>
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-black text-white">Step 2 of 2</span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <FlaskConical size={18} className="text-emerald-600" />
          <span className="text-sm font-bold text-slate-800">
            {batchImages.length} sample{batchImages.length === 1 ? '' : 's'} ready
          </span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs font-semibold text-slate-500">{selectedCount} selected for analysis</span>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setAllSelections(true)} className="rounded-lg bg-emerald-50 px-3 py-1.5 font-bold text-emerald-700 transition hover:bg-emerald-100">
            Select All
          </button>
          <button onClick={() => setAllSelections(false)} className="rounded-lg bg-slate-100 px-3 py-1.5 font-bold text-slate-600 transition hover:bg-slate-200">
            Deselect All
          </button>
        </div>
      </div>

      {/* Sample grid — image click → lightbox, footer → selection toggle */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {batchImages.map((item) => (
          <article
            key={item.id}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${
              deletingIds.has(item.id) ? 'translate-y-3 scale-90 opacity-0'
                : enteringIds.has(item.id) ? 'translate-y-2 scale-95 opacity-0'
                : 'translate-y-0 scale-100 opacity-100'
            } ${item.selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}
          >
            {/* Image — click opens lightbox */}
            <button
              type="button"
              onClick={() => openLightbox({ url: item.url, name: item.name })}
              className="group relative block w-full text-left"
              title="Click to enlarge"
            >
              <img
                src={item.url}
                alt={item.name}
                className={`h-36 w-full object-cover sm:h-40 transition-opacity ${item.selected ? 'opacity-100' : 'opacity-50'}`}
              />
              {/* Zoom hint on hover */}
              <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition group-hover:bg-slate-900/25">
                <ZoomIn size={26} className="text-white opacity-0 drop-shadow-lg transition group-hover:opacity-100" />
              </span>
              {/* Selected badge */}
              <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black ${item.selected ? 'bg-emerald-500 text-white' : 'bg-white/90 text-slate-500'}`}>
                {item.selected ? 'Selected' : 'Skipped'}
              </span>
            </button>

            {/* Card footer — toggle + source + delete */}
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <button
                type="button"
                onClick={() => toggleSelection(item.id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition ${
                  item.selected
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {item.selected ? '✓ Selected' : 'Include'}
              </button>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.source === 'pi' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                {item.source === 'pi' ? 'Pi' : 'Upload'}
              </span>
              <button
                type="button"
                onClick={() => deleteImageWithAnimation(item.id)}
                className="shrink-0 rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                title="Remove from batch"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      )}

      {/* Sticky analyse bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-10px_24px_-16px_rgba(0,0,0,0.35)] backdrop-blur"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => { void runAnalysis(true); }}
            disabled={selectedCount === 0 || isAnalyzing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FlaskConical size={16} />
            Analyse Selected ({selectedCount})
          </button>
          <button
            type="button"
            onClick={() => { void runAnalysis(false); }}
            disabled={batchImages.length === 0 || isAnalyzing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 size={16} />
            Analyse All ({batchImages.length})
          </button>
        </div>
      </div>
    </section>
  );

  // ─── ROOT ─────────────────────────────────────────────────────────────────

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => { void handleGallerySelection(event); }}
      />

      {step === 'capture' ? renderCaptureStep() : renderReviewStep()}

      {/* Lightbox — rendered above everything */}
      {renderLightbox()}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-slate-900/85 text-white backdrop-blur-sm">
          <LoaderCircle className="h-12 w-12 animate-spin text-emerald-300" />
          <p className="text-lg font-bold">Running Medical AI Analysis...</p>
          <p className="text-sm text-slate-300">Please wait while YOLO11 processes selected samples.</p>
        </div>
      )}
    </>
  );
};

export default CameraView;
