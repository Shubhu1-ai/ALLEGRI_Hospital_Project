import { BacteriaResult } from '../types';

interface DetectorDetection {
  box?: number[];
  class_id?: number;
  class_name?: string;
  confidence?: number;
  detection_id?: number;
}

interface DetectorResponse {
  detections?: DetectorDetection[];
  num_detections?: number;
  inference_time_ms?: number;
  used_sahi?: boolean;
  image_path?: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeServerBaseUrl = (rawUrl?: string): string => {
  const trimmed = (rawUrl ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return 'http://10.21.27.227:8000';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `http://${trimmed}`;
};

const mapDetectorResponseToBacteriaResults = (payload: DetectorResponse): BacteriaResult[] => {
  const detections = Array.isArray(payload.detections) ? payload.detections : [];
  const grouped = new Map<string, { count: number; confidenceTotal: number }>();

  for (const detection of detections) {
    const name = typeof detection.class_name === 'string' && detection.class_name.trim().length > 0
      ? detection.class_name.trim()
      : 'Unknown';

    const rawConfidence = typeof detection.confidence === 'number' ? detection.confidence : 0;
    const confidencePercentage = rawConfidence <= 1
      ? rawConfidence * 100
      : rawConfidence;

    const existing = grouped.get(name);
    if (existing) {
      existing.count += 1;
      existing.confidenceTotal += confidencePercentage;
    } else {
      grouped.set(name, {
        count: 1,
        confidenceTotal: confidencePercentage,
      });
    }
  }

  return Array.from(grouped.entries())
    .map(([Name, stats]) => ({
      Name,
      Count: stats.count,
      AccuracyPercentage: Number(clamp(stats.confidenceTotal / stats.count, 0, 100).toFixed(2)),
    }))
    .sort((a, b) => b.Count - a.Count || b.AccuracyPercentage - a.AccuracyPercentage);
};

export const runLocalAI = async (imageBlob: Blob): Promise<BacteriaResult[]> => {
  if (!(imageBlob instanceof Blob)) {
    throw new TypeError('Invalid image payload: expected Blob.');
  }

  if (imageBlob.size === 0) {
    throw new Error('Image payload is empty. Please capture a valid image.');
  }

  const serverBaseUrl = normalizeServerBaseUrl(import.meta.env.VITE_PI_SERVER_URL as string | undefined);
  const endpoint = `${serverBaseUrl}/analyze`;

  const formData = new FormData();
  const extension = imageBlob.type.includes('png') ? 'png' : 'jpg';
  formData.append('file', imageBlob, `sample.${extension}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let reason = `AI server request failed with HTTP ${response.status}.`;
    try {
      const errorPayload = (await response.json()) as { detail?: string; message?: string };
      reason = errorPayload.detail ?? errorPayload.message ?? reason;
    } catch {
      // Ignore JSON parse errors; fallback to HTTP reason string.
    }

    throw new Error(reason);
  }

  const payload = (await response.json()) as DetectorResponse;
  return mapDetectorResponseToBacteriaResults(payload);
};
