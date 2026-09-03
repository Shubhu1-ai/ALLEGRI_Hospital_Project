import React, { useEffect, useMemo, useState } from 'react';
import { CopyPlus, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { AnalysisResult, DetectionOverlay, Prediction } from '../types';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeDetections = (detections: DetectionOverlay[] | undefined): DetectionOverlay[] => {
  if (!Array.isArray(detections)) {
    return [];
  }

  return detections.flatMap((detection) => {
    if (!Array.isArray(detection.box) || detection.box.length < 4) {
      return [];
    }

    const numericBox = detection.box.slice(0, 4).map((value) => Number(value));
    if (numericBox.some((value) => !Number.isFinite(value))) {
      return [];
    }

    return [{
      box: [numericBox[0], numericBox[1], numericBox[2], numericBox[3]] as [number, number, number, number],
      class_name: (detection.class_name ?? 'Unknown').trim() || 'Unknown',
      confidence: clamp(Number.isFinite(detection.confidence) ? detection.confidence : 0, 0, 100),
    }];
  });
};

const buildPredictionDetections = (predictions: Prediction[] | undefined): DetectionOverlay[] => {
  if (!Array.isArray(predictions)) {
    return [];
  }

  return predictions.flatMap((prediction) => {
    const label = (prediction.name ?? '').trim();
    if (!label) {
      return [];
    }

    const count = Math.max(1, Math.round(prediction.count ?? 1));
    return Array.from({ length: count }, () => ({
      box: [0, 0, 0, 0] as [number, number, number, number],
      class_name: label,
      confidence: clamp(Number.isFinite(prediction.confidence) ? prediction.confidence : 0, 0, 100),
    }));
  });
};

export const detectionsFromResult = (result: AnalysisResult): DetectionOverlay[] => {
  const normalized = normalizeDetections(result.detections);
  if (normalized.length > 0) {
    return normalized;
  }

  return buildPredictionDetections(result.predictions);
};

const buildPredictionsFromDetections = (detections: DetectionOverlay[]): Prediction[] => {
  const grouped = new Map<string, { count: number; confidenceTotal: number }>();

  for (const detection of detections) {
    const key = detection.class_name;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.confidenceTotal += detection.confidence;
    } else {
      grouped.set(key, { count: 1, confidenceTotal: detection.confidence });
    }
  }

  return Array.from(grouped.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      confidence: Number((stats.confidenceTotal / stats.count).toFixed(2)),
    }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || b.confidence - a.confidence);
};

export const getResultImageUrl = (result: AnalysisResult): string => {
  if (typeof result.annotatedImageUrl === 'string' && result.annotatedImageUrl.trim().length > 0) {
    return result.annotatedImageUrl;
  }

  if (typeof result.imageUrl === 'string' && result.imageUrl.trim().length > 0) {
    return result.imageUrl;
  }

  const legacyImageUrl = (result as AnalysisResult & { ImageURL?: string }).ImageURL;
  if (typeof legacyImageUrl === 'string' && legacyImageUrl.trim().length > 0) {
    return legacyImageUrl;
  }

  return '';
};

const isBrowserDataUrl = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().toLowerCase().startsWith('data:');

const getOriginalResultImageUrl = (result: AnalysisResult): string => {
  if (typeof result.originalImageUrl === 'string' && result.originalImageUrl.trim().length > 0 && !isBrowserDataUrl(result.originalImageUrl)) {
    return result.originalImageUrl.trim();
  }

  if ((!result.annotatedImageUrl || result.annotatedImageUrl.trim().length === 0) && typeof result.imageUrl === 'string' && result.imageUrl.trim().length > 0 && !isBrowserDataUrl(result.imageUrl)) {
    return result.imageUrl.trim();
  }

  const legacyImageUrl = (result as AnalysisResult & { ImageURL?: string }).ImageURL;
  if ((!result.annotatedImageUrl || result.annotatedImageUrl.trim().length === 0) && typeof legacyImageUrl === 'string' && legacyImageUrl.trim().length > 0 && !isBrowserDataUrl(legacyImageUrl)) {
    return legacyImageUrl.trim();
  }

  return '';
};

interface DetectionImageProps {
  src: string;
  alt: string;
  detections?: DetectionOverlay[];
  className: string;
  imageClassName: string;
  zoom?: number;
}

export const DetectionImage: React.FC<DetectionImageProps> = ({ src, alt, detections, className, imageClassName, zoom = 1 }) => {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const safeDetections = useMemo(
    () =>
      (Array.isArray(detections) ? detections : [])
        .map((detection) => {
          const box = Array.isArray(detection.box) ? detection.box.slice(0, 4).map((value) => Number(value)) : [];
          if (box.length < 4 || box.some((value) => !Number.isFinite(value))) {
            return null;
          }

          const [x1, y1, x2, y2] = box;
          return {
            box: [x1, y1, x2, y2] as [number, number, number, number],
            class_name: detection.class_name || 'Unknown',
            confidence: clamp(Number.isFinite(detection.confidence) ? detection.confidence : 0, 0, 100),
          };
        })
        .filter((detection): detection is DetectionOverlay => detection !== null),
    [detections],
  );

  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500`}>
        No image
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-slate-900/5`}>
      <div
        className="relative inline-block"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <img
          src={src}
          alt={alt}
          className={imageClassName}
          onLoad={(event) => {
            const image = event.currentTarget;
            setNaturalSize({
              width: image.naturalWidth || image.width || 1,
              height: image.naturalHeight || image.height || 1,
            });
          }}
        />

        {naturalSize.width > 0 && naturalSize.height > 0 && safeDetections.map((detection, index) => {
          const [x1, y1, x2, y2] = detection.box;
          const leftPx = Math.min(x1, x2);
          const topPx = Math.min(y1, y2);
          const widthPx = Math.abs(x2 - x1);
          const heightPx = Math.abs(y2 - y1);

          if (widthPx <= 0 || heightPx <= 0) {
            return null;
          }

          const left = clamp((leftPx / naturalSize.width) * 100, 0, 100);
          const top = clamp((topPx / naturalSize.height) * 100, 0, 100);
          const width = clamp((widthPx / naturalSize.width) * 100, 0, 100 - left);
          const height = clamp((heightPx / naturalSize.height) * 100, 0, 100 - top);
          const labelWithinBox = top < 10;
          const confidenceLabel = `${detection.confidence.toFixed(1)}%`;

          return (
            <div
              key={`${detection.class_name}-${index}-${detection.box.join('-')}`}
              className="pointer-events-none absolute border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${Math.max(width, 1)}%`,
                height: `${Math.max(height, 1)}%`,
              }}
            >
              <span
                className={`absolute left-0 max-w-[220px] truncate rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white ${
                  labelWithinBox ? 'top-0 translate-y-0' : '-top-1 -translate-y-full'
                }`}
              >
                {detection.class_name} {confidenceLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DoctorOverrideModalProps {
  result: AnalysisResult | null;
  onClose: () => void;
  onSaveCopy: (copy: AnalysisResult) => void;
}

const DoctorOverrideModal: React.FC<DoctorOverrideModalProps> = ({ result, onClose, onSaveCopy }) => {
  const [modalZoom, setModalZoom] = useState(1);
  const [editableDetections, setEditableDetections] = useState<DetectionOverlay[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!result) {
      setModalZoom(1);
      setEditableDetections([]);
      setModalError(null);
      return;
    }

    setModalZoom(1);
    setEditableDetections(detectionsFromResult(result));
    setModalError(null);
  }, [result]);

  if (!result) {
    return null;
  }

  const closeModal = () => {
    setModalZoom(1);
    setEditableDetections([]);
    setModalError(null);
    onClose();
  };

  const zoomInModalImage = () => {
    setModalZoom((current) => Number(clamp(current + 0.25, 1, 4).toFixed(2)));
  };

  const zoomOutModalImage = () => {
    setModalZoom((current) => Number(clamp(current - 0.25, 1, 4).toFixed(2)));
  };

  const resetModalZoom = () => {
    setModalZoom(1);
  };

  const updateDetection = (index: number, updates: Partial<DetectionOverlay>) => {
    setEditableDetections((prev) =>
      prev.map((detection, rowIndex) => (rowIndex === index ? { ...detection, ...updates } : detection)),
    );
  };

  const removeDetectionAt = (index: number) => {
    setEditableDetections((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const saveCopy = () => {
    const sanitizedDetections = editableDetections
      .map((detection) => ({
        box: detection.box,
        class_name: (detection.class_name ?? '').trim(),
        confidence: clamp(detection.confidence, 0, 100),
      }))
      .filter((detection) => detection.class_name.length > 0);

    if (sanitizedDetections.length === 0) {
      setModalError('At least one valid detection row is required before saving a copy.');
      return;
    }

    const predictions = buildPredictionsFromDetections(sanitizedDetections);
    const top = predictions[0] ?? { name: 'No Detection', confidence: 0 };
    const now = new Date().toISOString();
    const originalName = result.imageName || `Sample_${result.id.slice(0, 5)}`;
    const lineageRoot = result.originalImageId ?? result.remoteRecordId ?? result.id;
    const previewImageUrl = getResultImageUrl(result);
    const originalImageUrl = getOriginalResultImageUrl(result);
    const storedImageUrl = originalImageUrl || previewImageUrl;

    if (!storedImageUrl) {
      setModalError('This case does not have a Raspberry Pi image URL yet. Open it from Patient History before saving a copy.');
      return;
    }

    const copiedResult: AnalysisResult = {
      ...result,
      id: createId(),
      timestamp: now,
      imageUrl: storedImageUrl,
      annotatedImageUrl: previewImageUrl && previewImageUrl !== originalImageUrl ? previewImageUrl : undefined,
      originalImageUrl: originalImageUrl || undefined,
      imageName: `Copy of ${originalName}`,
      bacteriaType: top.name,
      confidence: top.confidence,
      accuracy: top.confidence,
      predictions,
      detections: sanitizedDetections,
      detectionCount: sanitizedDetections.length,
      summary: `Doctor-edited copy with ${sanitizedDetections.length} detection${sanitizedDetections.length === 1 ? '' : 's'} derived from ${originalName}.`,
      notes: `Doctor override applied on ${new Date(now).toLocaleString()}.`,
      isEditedCopy: true,
      isEditedByDoctor: true,
      originalImageId: lineageRoot,
      source: result.source === 'patient-history' || Boolean(result.remoteRecordId) ? 'patient-history' : 'local',
      status: 'completed',
    };

    onSaveCopy(copiedResult);
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-[260] bg-slate-900/70 backdrop-blur-sm md:p-4">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col bg-slate-50 md:max-w-6xl md:rounded-3xl md:border md:border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-black text-slate-800">{result.imageName || result.bacteriaType}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Doctor Override Modal</p>
          </div>
          <button onClick={closeModal} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="relative mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="h-[50vh] overflow-auto p-2 md:h-[60vh]">
              <DetectionImage
                src={getResultImageUrl(result)}
                alt={result.imageName || 'Sample'}
                detections={editableDetections}
                zoom={modalZoom}
                className="inline-block min-w-full"
                imageClassName="block h-auto w-full"
              />
            </div>

            <div className="absolute right-3 top-3 z-20">
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
                <button
                  type="button"
                  onClick={zoomInModalImage}
                  disabled={modalZoom >= 4}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={zoomOutModalImage}
                  disabled={modalZoom <= 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={resetModalZoom}
                  disabled={modalZoom === 1}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Reset Zoom"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Detection</th>
                  <th className="px-3 py-2">Bacteria Name</th>
                  <th className="px-3 py-2">Accuracy (%)</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {editableDetections.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td colSpan={4} className="px-3 py-3 text-xs text-slate-500">
                      No saved detections are available for this case.
                    </td>
                  </tr>
                ) : (
                  editableDetections.map((detection, index) => (
                    <tr key={`${detection.class_name}-${index}-${detection.box.join('-')}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">#{index + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          value={detection.class_name}
                          onChange={(event) => updateDetection(index, { class_name: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => updateDetection(index, { confidence: clamp(detection.confidence - 0.5, 0, 100) })}
                            className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 text-sm font-black text-slate-700"
                          >
                            -
                          </button>
                          <span className="min-w-16 text-center font-bold text-slate-700">{detection.confidence.toFixed(1)}%</span>
                          <button
                            onClick={() => updateDetection(index, { confidence: clamp(detection.confidence + 0.5, 0, 100) })}
                            className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 text-sm font-black text-slate-700"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeDetectionAt(index)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700"
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {modalError && <p className="mt-3 text-sm font-semibold text-rose-600">{modalError}</p>}
        </div>

        <div className="mt-auto border-t border-slate-200 bg-white p-4">
          <button
            onClick={saveCopy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            <CopyPlus size={16} />
            Save Copy
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorOverrideModal;


