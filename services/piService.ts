import { AnalysisResult, DetectionOverlay, Prediction } from '../types';
import { PI_ANALYZE_URL, PI_API_BASE_URL, PI_FINALIZE_URL, PI_HISTORY_URL } from './piConfig';

interface YoloDetection {
  box?: number[];
  class_name?: string;
  confidence?: number;
}

interface YoloAnalyzeResponse {
  detections?: YoloDetection[];
  num_detections?: number;
  inference_time_ms?: number;
  used_sahi?: boolean;
  annotatedImageUrl?: string;
  annotated_image_url?: string;
  processed_image_url?: string;
  processedImageUrl?: string;
  annotated_image?: string;
  annotatedImage?: string;
  originalImageUrl?: string;
  original_image_url?: string;
  capture_url?: string;
  captureUrl?: string;
  image_path?: string;
  imagePath?: string;
  imageUrl?: string;
  image_url?: string;
}

interface AnalyzeMetadata {
  imageName?: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const PI_ANALYZE_TIMEOUT_MS = 90_000;

let insecurePiWarningShown = false;

const createResultId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const warnIfInsecurePiConnectionMayBeBlocked = (targetUrl: string): void => {
  if (
    insecurePiWarningShown
    || typeof window === 'undefined'
    || window.location.protocol !== 'https:'
    || !/^http:\/\//i.test(targetUrl)
  ) {
    return;
  }

  insecurePiWarningShown = true;
  console.warn('Insecure Pi connection may be blocked by the browser.');
};

const toFriendlyPiConnectionMessage = (error: unknown, fallback: string): string => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return `Raspberry Pi analysis timed out after ${Math.round(PI_ANALYZE_TIMEOUT_MS / 1000)} seconds.`;
  }

  const message = error instanceof Error ? error.message : fallback;
  return message === 'Failed to fetch' || message.includes('Failed to fetch')
    ? 'Cannot connect to Raspberry Pi. Ensure you are on the "Noting" hotspot.'
    : message;
};

const normalizeConfidence = (rawConfidence: number | undefined): number => {
  if (typeof rawConfidence !== 'number' || !Number.isFinite(rawConfidence)) {
    return 0;
  }

  const normalized = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
  return Number(clamp(normalized, 0, 100).toFixed(2));
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Invalid image payload format.');
  }

  const metadata = parts[0];
  const data = parts[1];
  const mimeMatch = metadata.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? 'image/jpeg';

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
};

const toAbsolutePiUrl = (rawValue: unknown): string => {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    const relativePath = trimmed.replace(/^\.?\//, '');
    try {
      return new URL(relativePath, `${PI_API_BASE_URL}/`).toString();
    } catch {
      return '';
    }
  }
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const readString = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
};

// Like readString but also accepts numeric values (Pi backend returns integer IDs).
const readId = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
};

const readNumber = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const buildPredictions = (detections: YoloDetection[]): Prediction[] => {
  const grouped = new Map<string, { count: number; confidenceTotal: number }>();

  for (const detection of detections) {
    const name = typeof detection.class_name === 'string' && detection.class_name.trim().length > 0
      ? detection.class_name.trim()
      : 'Unknown';
    const confidence = normalizeConfidence(detection.confidence);

    const current = grouped.get(name);
    if (current) {
      current.count += 1;
      current.confidenceTotal += confidence;
    } else {
      grouped.set(name, { count: 1, confidenceTotal: confidence });
    }
  }

  return Array.from(grouped.entries())
    .map(([name, stats]) => ({
      name,
      confidence: Number((stats.confidenceTotal / stats.count).toFixed(2)),
      count: stats.count,
    }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || b.confidence - a.confidence);
};

const normalizeDetections = (detections: YoloDetection[]): DetectionOverlay[] =>
  detections.flatMap((detection) => {
    if (!Array.isArray(detection.box) || detection.box.length < 4) {
      return [];
    }

    const numeric = detection.box
      .slice(0, 4)
      .map((value) => Number(value));

    if (numeric.some((value) => !Number.isFinite(value))) {
      return [];
    }

    const [x1, y1, x2, y2] = numeric;
    const className = typeof detection.class_name === 'string' && detection.class_name.trim().length > 0
      ? detection.class_name.trim()
      : 'Unknown';

    return [{
      box: [x1, y1, x2, y2],
      class_name: className,
      confidence: normalizeConfidence(detection.confidence),
    }];
  });

const normalizeLegacyPredictions = (value: unknown): Prediction[] => {
  const rows = asArray<Record<string, unknown>>(value);

  return rows
    .map((row) => {
      const name = readString(row, ['name', 'Name', 'class_name', 'bacteriaType', 'bacteria_type']);
      if (!name) {
        return null;
      }

      return {
        name,
        confidence: normalizeConfidence(readNumber(row, ['confidence', 'AccuracyPercentage', 'accuracy', 'confidence_score'])),
        count: Math.max(1, Math.round(readNumber(row, ['count', 'Count']) ?? 1)),
      } satisfies Prediction;
    })
    .filter((row): row is { name: string; confidence: number; count: number } => row !== null);
};

const buildSyntheticDetectionsFromPredictions = (predictions: Prediction[]): DetectionOverlay[] =>
  predictions.flatMap((prediction) => {
    const count = Math.max(1, Math.round(prediction.count ?? 1));

    return Array.from({ length: count }, () => ({
      box: [0, 0, 0, 0] as [number, number, number, number],
      class_name: prediction.name,
      confidence: normalizeConfidence(prediction.confidence),
    }));
  });

const resolvePiImageUrls = (record: Record<string, unknown>): {
  imageUrl: string;
  annotatedImageUrl?: string;
  originalImageUrl?: string;
} => {
  const annotatedImageUrl = toAbsolutePiUrl(
    readString(record, [
      'annotatedImageUrl',
      'annotated_image_url',
      'annotatedImage',
      'annotated_image',
      'processed_image_url',
      'processedImageUrl',
      'imageProcessed',
      'annotated_path',
    ]),
  );

  const originalImageUrl = toAbsolutePiUrl(
    readString(record, [
      'originalImageUrl',
      'original_image_url',
      'capture_url',
      'captureUrl',
      'image_path',
      'imagePath',
      'ImageURL',
      'imageUrl',
      'image_url',
    ]),
  );

  return {
    imageUrl: annotatedImageUrl || originalImageUrl,
    annotatedImageUrl: annotatedImageUrl || undefined,
    originalImageUrl: originalImageUrl || undefined,
  };
};

const normalizeHistoryRecord = (record: Record<string, unknown>): AnalysisResult => {
  const predictions = normalizeLegacyPredictions(record.predictions ?? record.Results ?? record.results);
  const detections = normalizeDetections(asArray<YoloDetection>(record.detections));
  const detectionRows = detections.length > 0 ? detections : buildSyntheticDetectionsFromPredictions(predictions);
  const topPrediction = predictions[0] ?? {
    name: readString(record, ['bacteriaType', 'bacteria_type', 'identified_bacteria', 'top_prediction', 'class_name']) || 'Historical Result',
    confidence: normalizeConfidence(readNumber(record, ['confidence', 'accuracy', 'confidence_score', 'AccuracyPercentage'])),
    count: detectionRows.length,
  };

  const { imageUrl, annotatedImageUrl, originalImageUrl } = resolvePiImageUrls(record);

  const timestamp = readString(record, ['timestamp', 'Timestamp', 'created_at', 'createdAt', 'date']) || new Date().toISOString();
  const imageName = readString(record, ['imageName', 'image_name', 'GeneratedFilename', 'generated_filename', 'filename', 'file_name']);
  const explicitStatus = readString(record, ['status', 'Status']);
  const status: AnalysisResult['status'] = explicitStatus === 'pending' || explicitStatus === 'failed' ? explicitStatus : 'completed';

  const resolvedId = readId(record, ['id', 'ID', 'record_id', 'recordId']) || createResultId();
  console.debug('[piService] normalizeHistoryRecord — resolved id:', resolvedId, '(raw record id field:', record['id'] ?? record['ID'] ?? record['record_id'] ?? record['recordId'], ')');

  return {
    id: resolvedId,
    remoteRecordId: readId(record, ['id', 'ID', 'record_id', 'recordId']) || undefined,
    imageUrl,
    annotatedImageUrl,
    originalImageUrl,
    imageName: imageName || undefined,
    timestamp,
    bacteriaType: topPrediction.name,
    accuracy: topPrediction.confidence,
    confidence: topPrediction.confidence,
    predictions,
    detections: detectionRows,
    detectionCount: Math.max(0, Math.round(readNumber(record, ['detectionCount', 'detection_count', 'num_detections']) ?? detectionRows.length)),
    summary: readString(record, ['summary', 'Summary']) || undefined,
    notes: readString(record, ['notes', 'detail', 'message', 'Notes']) || 'Loaded from Raspberry Pi patient history.',
    isEditedCopy: Boolean(record.isEditedCopy),
    isEditedByDoctor: Boolean(record.isEditedByDoctor ?? record.IsEditedByDoctor),
    originalImageId: readString(record, ['originalImageId', 'original_image_id', 'source_id']) || undefined,
    source: 'patient-history',
    status,
  };
};

export const analyzeImageWithPi = async (imageBase64: string, metadata?: AnalyzeMetadata): Promise<AnalysisResult> => {
  const timestamp = new Date().toISOString();
  const imageName = metadata?.imageName ?? `Sample_${Date.now()}`;
  const defaultFailureResult: AnalysisResult = {
    id: createResultId(),
    imageUrl: '',
    originalImageUrl: '',
    imageName,
    timestamp,
    bacteriaType: 'Analysis Failed',
    accuracy: 0,
    confidence: 0,
    predictions: [],
    detections: [],
    detectionCount: 0,
    summary: 'YOLO11 request failed.',
    notes: 'Unable to connect to AI server.',
    isEditedCopy: false,
    source: 'local',
    status: 'failed',
  };

  try {
    warnIfInsecurePiConnectionMayBeBlocked(PI_ANALYZE_URL);

    const imageBlob = dataUrlToBlob(imageBase64);
    const extension = imageBlob.type.includes('png') ? 'png' : 'jpg';
    const formData = new FormData();
    formData.append('file', imageBlob, `capture-${Date.now()}.${extension}`);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PI_ANALYZE_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(PI_ANALYZE_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let reason = `AI server request failed with HTTP ${response.status}.`;
      try {
        const payload = (await response.json()) as { detail?: string; message?: string };
        reason = payload.detail ?? payload.message ?? reason;
      } catch {
        // Keep HTTP status fallback reason.
      }

      return {
        ...defaultFailureResult,
        notes: reason,
      };
    }

    const payload = (await response.json()) as YoloAnalyzeResponse;
    const payloadRecord = payload as Record<string, unknown>;
    const { imageUrl, annotatedImageUrl, originalImageUrl } = resolvePiImageUrls(payloadRecord);
    const detections = Array.isArray(payload.detections) ? payload.detections : [];
    const normalizedDetections = normalizeDetections(detections);
    const predictions = buildPredictions(detections);
    const topPrediction = predictions[0] ?? { name: 'No Detection', confidence: 0 };
    const detectionCount = typeof payload.num_detections === 'number'
      ? payload.num_detections
      : normalizedDetections.length;
    const inferenceMs = typeof payload.inference_time_ms === 'number' ? payload.inference_time_ms : null;
    const summary = `YOLO11 detected ${detectionCount} object${detectionCount === 1 ? '' : 's'}.`;
    const methodSuffix = payload.used_sahi ? ' SAHI enabled.' : '';
    const timingSuffix = inferenceMs !== null ? ` Inference: ${inferenceMs.toFixed(2)} ms.` : '';

    return {
      id: createResultId(),
      imageUrl,
      annotatedImageUrl,
      originalImageUrl,
      imageName,
      timestamp,
      bacteriaType: topPrediction.name,
      accuracy: topPrediction.confidence,
      confidence: topPrediction.confidence,
      predictions,
      detections: normalizedDetections,
      detectionCount,
      summary,
      notes: `${summary}${timingSuffix}${methodSuffix}`.trim(),
      isEditedCopy: false,
      source: 'local',
      status: 'completed',
    };
  } catch (error) {
    return {
      ...defaultFailureResult,
      notes: toFriendlyPiConnectionMessage(error, 'Unexpected analysis error.'),
    };
  }
};

export const deleteHistoryRecord = async (piId: string): Promise<void> => {
  const deleteUrl = `${PI_HISTORY_URL}/${encodeURIComponent(piId)}`;
  console.log('[piService] DELETE', deleteUrl);

  warnIfInsecurePiConnectionMayBeBlocked(PI_HISTORY_URL);

  // Separate network errors from HTTP errors — no nested try/catch.
  let response: Response;
  try {
    response = await fetch(deleteUrl, { method: 'DELETE' });
  } catch (networkError) {
    throw new Error(toFriendlyPiConnectionMessage(networkError, 'Network error — could not reach Raspberry Pi.'));
  }

  if (!response.ok) {
    let reason = `Delete failed — HTTP ${response.status} from Raspberry Pi.`;
    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      reason = payload.detail ?? payload.message ?? reason;
    } catch {
      // Non-JSON body — keep the HTTP status reason.
    }
    throw new Error(reason);
  }
};

export interface FinalizeParams {
  /** Raw original image Blob captured or uploaded before /analyze */
  imageBlob: Blob;
  /** Absolute URL of the annotated image returned by /analyze — fetched to Blob here */
  annotatedImageUrl: string;
  patientId: string;
  /** 0.0 – 1.0 */
  confidenceScore: number;
  /** ISO 8601, e.g. "2026-03-24T10:30:00.000Z" */
  diagnosticDatetime?: string;
}

export interface FinalizeResponse {
  history_id: number;
  image_urls: Record<string, string>;
}

export const finalizeAnalysis = async (params: FinalizeParams): Promise<FinalizeResponse> => {
  const { imageBlob, annotatedImageUrl, patientId, confidenceScore, diagnosticDatetime } = params;

  warnIfInsecurePiConnectionMayBeBlocked(PI_FINALIZE_URL);

  // Fetch the annotated image from the Pi and convert to Blob so we can re-upload it.
  let annotatedBlob: Blob;
  try {
    const annotatedRes = await fetch(annotatedImageUrl);
    if (!annotatedRes.ok) {
      throw new Error(`Fetching annotated image failed — HTTP ${annotatedRes.status}.`);
    }
    annotatedBlob = await annotatedRes.blob();
  } catch (fetchError) {
    throw new Error(toFriendlyPiConnectionMessage(fetchError, 'Failed to retrieve annotated image from Raspberry Pi.'));
  }

  const formData = new FormData();
  formData.append('patient_id', patientId.trim() || 'patient_001');
  formData.append('confidence_score', String(Number(confidenceScore.toFixed(6))));
  if (diagnosticDatetime) {
    formData.append('diagnostic_datetime', diagnosticDatetime);
  }

  const origExt = imageBlob.type.includes('png') ? 'png' : 'jpg';
  const annExt = annotatedBlob.type.includes('png') ? 'png' : 'jpg';
  formData.append('original_image', imageBlob, `original.${origExt}`);
  formData.append('annotated_image', annotatedBlob, `annotated.${annExt}`);

  console.log('[piService] POST', PI_FINALIZE_URL, '— patient_id:', patientId, 'confidence:', confidenceScore);

  let response: Response;
  try {
    response = await fetch(PI_FINALIZE_URL, { method: 'POST', body: formData });
  } catch (networkError) {
    throw new Error(toFriendlyPiConnectionMessage(networkError, 'Network error — could not reach Raspberry Pi /finalize.'));
  }

  if (!response.ok) {
    let reason = `Finalize failed — HTTP ${response.status} from Raspberry Pi.`;
    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      reason = payload.detail ?? payload.message ?? reason;
    } catch {
      // Non-JSON body — keep HTTP status reason.
    }
    throw new Error(reason);
  }

  const result = (await response.json()) as FinalizeResponse;
  if (typeof result.history_id !== 'number') {
    throw new Error('Finalize response did not include a numeric history_id.');
  }

  console.log('[piService] /finalize success — history_id:', result.history_id);
  return result;
};

export const fetchPatientHistory = async (): Promise<AnalysisResult[]> => {
  try {
    warnIfInsecurePiConnectionMayBeBlocked(PI_HISTORY_URL);

    const response = await fetch(PI_HISTORY_URL, {
      method: 'GET',
    });

    if (!response.ok) {
      let reason = `Patient history request failed with HTTP ${response.status}.`;
      try {
        const payload = (await response.json()) as { detail?: string; message?: string };
        reason = payload.detail ?? payload.message ?? reason;
      } catch {
        // Keep HTTP status fallback reason.
      }

      throw new Error(reason);
    }

    const payload = await response.json() as unknown;
    const records = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).history)
        ? (payload as Record<string, unknown>).history
        : Array.isArray((payload as Record<string, unknown>).records)
          ? (payload as Record<string, unknown>).records
          : Array.isArray((payload as Record<string, unknown>).data)
            ? (payload as Record<string, unknown>).data
            : [];

    return asArray<Record<string, unknown>>(records)
      .map((record) => normalizeHistoryRecord(record))
      .filter((record) => record.imageUrl || record.detections?.length || record.predictions?.length);
  } catch (error) {
    throw new Error(
      toFriendlyPiConnectionMessage(error, 'Failed to load patient history from Raspberry Pi.'),
    );
  }
};
