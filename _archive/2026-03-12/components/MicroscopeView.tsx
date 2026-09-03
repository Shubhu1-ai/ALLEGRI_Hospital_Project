import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, Microscope, TriangleAlert, Trash2, Upload, ZoomIn } from 'lucide-react';
import { runLocalAI } from '../services/aiService';
import { AnalysisRecord } from '../types';

interface MicroscopeViewProps {
  serverBaseUrl: string;
  onCaptureComplete: (record: AnalysisRecord) => void;
}

type CaptureMode = 'pi' | 'phone' | 'gallery';
type HealthStatus = 'checking' | 'online' | 'offline';

const resolveHealthServerBaseUrl = (envBaseUrl: string | undefined, fallbackPiBaseUrl: string): string => {
  const envTrimmed = (envBaseUrl ?? '').trim().replace(/\/+$/, '');
  if (envTrimmed) {
    if (/^https?:\/\//i.test(envTrimmed)) {
      return envTrimmed;
    }

    return `http://${envTrimmed}`;
  }

  try {
    const fallbackUrl = new URL(fallbackPiBaseUrl);
    fallbackUrl.port = '8000';
    fallbackUrl.pathname = '';
    fallbackUrl.search = '';
    fallbackUrl.hash = '';
    return fallbackUrl.toString().replace(/\/+$/, '');
  } catch {
    return 'http://127.0.0.1:8000';
  }
};

const buildDateGroupLabel = (timestampIso: string): string => {
  const now = new Date();
  const value = new Date(timestampIso);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  const day = target.getDate();
  const remainder = day % 10;
  const teens = day % 100;
  let suffix = 'th';
  if (teens < 11 || teens > 13) {
    if (remainder === 1) suffix = 'st';
    if (remainder === 2) suffix = 'nd';
    if (remainder === 3) suffix = 'rd';
  }

  return `${target.toLocaleString(undefined, { month: 'long' })} ${day}${suffix}, ${target.getFullYear()}`;
};

const createRecordId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const parseGeneratedFilename = (headers: Headers): string => {
  const filenameHeader = headers.get('X-Generated-Filename');
  if (filenameHeader) {
    return filenameHeader;
  }

  const contentDisposition = headers.get('content-disposition');
  if (!contentDisposition) {
    return `capture_${Date.now()}.png`;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const fallbackMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (fallbackMatch?.[1]) {
    return fallbackMatch[1];
  }

  return `capture_${Date.now()}.png`;
};

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to convert blob to image URL.'));
    };
    reader.onerror = () => reject(new Error('Image decoding failed.'));
    reader.readAsDataURL(blob);
  });

const captureFrameFromVideo = (video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const frameWidth = video.videoWidth;
    const frameHeight = video.videoHeight;

    if (!frameWidth || !frameHeight) {
      reject(new Error('Phone camera stream is not ready yet.'));
      return;
    }

    canvas.width = frameWidth;
    canvas.height = frameHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Unable to initialize capture canvas.'));
      return;
    }

    context.drawImage(video, 0, 0, frameWidth, frameHeight);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('Failed to capture phone camera frame.'));
      },
      'image/jpeg',
      0.95,
    );
  });

const MicroscopeView: React.FC<MicroscopeViewProps> = ({ serverBaseUrl, onCaptureComplete }) => {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('pi');

  const [isAcquiring, setIsAcquiring] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [acquireLabel, setAcquireLabel] = useState('Preparing sample...');

  const [captureError, setCaptureError] = useState<string | null>(null);
  const [piStreamError, setPiStreamError] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');

  const [latestObjectUrl, setLatestObjectUrl] = useState<string | null>(null);
  const [latestFilename, setLatestFilename] = useState<string | null>(null);
  const [latestCapturedAt, setLatestCapturedAt] = useState<string | null>(null);

  const [isPhoneCameraStarting, setIsPhoneCameraStarting] = useState(false);
  const [phoneCameraError, setPhoneCameraError] = useState<string | null>(null);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [zoomStep, setZoomStep] = useState(0.1);
  const [zoomValue, setZoomValue] = useState(1);

  const phoneStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Required memory cleanup for mobile devices when previews change or the screen unmounts.
  useEffect(() => {
    return () => {
      if (latestObjectUrl) {
        URL.revokeObjectURL(latestObjectUrl);
      }
    };
  }, [latestObjectUrl]);

  const streamEndpoint = useMemo(() => `${serverBaseUrl}/flux`, [serverBaseUrl]);
  const captureEndpoint = useMemo(() => `${serverBaseUrl}/capturer`, [serverBaseUrl]);
  const healthEndpoint = useMemo(() => {
    const healthBaseUrl = resolveHealthServerBaseUrl(import.meta.env.VITE_PI_SERVER_URL as string | undefined, serverBaseUrl);
    return `${healthBaseUrl}/health`;
  }, [serverBaseUrl]);

  const stopPhoneCamera = useCallback((): void => {
    if (phoneStreamRef.current) {
      phoneStreamRef.current.getTracks().forEach((track) => track.stop());
      phoneStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setZoomSupported(false);
    setZoomMin(1);
    setZoomMax(1);
    setZoomStep(0.1);
    setZoomValue(1);
  }, []);

  const startPhoneCamera = useCallback(async (): Promise<void> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhoneCameraError('This device/browser does not support getUserMedia.');
      return;
    }

    setPhoneCameraError(null);
    setIsPhoneCameraStarting(true);

    try {
      stopPhoneCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      phoneStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = typeof (track as any).getCapabilities === 'function' ? (track as any).getCapabilities() : null;
      const zoomCapabilities = capabilities?.zoom;

      if (
        zoomCapabilities &&
        typeof zoomCapabilities.min === 'number' &&
        typeof zoomCapabilities.max === 'number' &&
        zoomCapabilities.max > zoomCapabilities.min
      ) {
        const minimumZoom = zoomCapabilities.min;
        const maximumZoom = zoomCapabilities.max;
        const step = typeof zoomCapabilities.step === 'number' && zoomCapabilities.step > 0 ? zoomCapabilities.step : 0.1;

        setZoomSupported(true);
        setZoomMin(minimumZoom);
        setZoomMax(maximumZoom);
        setZoomStep(step);
        setZoomValue(minimumZoom);

        await track.applyConstraints({
          advanced: [{ zoom: minimumZoom } as any],
        });
      } else {
        setZoomSupported(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start rear camera.';
      setPhoneCameraError(message);
      stopPhoneCamera();
    } finally {
      setIsPhoneCameraStarting(false);
    }
  }, [stopPhoneCamera]);

  useEffect(() => {
    if (captureMode === 'phone') {
      void startPhoneCamera();
      return () => stopPhoneCamera();
    }

    stopPhoneCamera();
    return undefined;
  }, [captureMode, startPhoneCamera, stopPhoneCamera]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    const checkBackendHealth = async (): Promise<void> => {
      setHealthStatus('checking');

      try {
        const response = await fetch(healthEndpoint, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Health check failed with HTTP ${response.status}.`);
        }

        const payload = (await response.json()) as { status?: string };
        if (isMounted) {
          setHealthStatus(payload?.status === 'online' ? 'online' : 'offline');
        }
      } catch {
        if (isMounted) {
          setHealthStatus('offline');
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void checkBackendHealth();

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [healthEndpoint]);

  const processBlobPipeline = useCallback(
    async (blob: Blob, filename: string): Promise<void> => {
      if (blob.size === 0) {
        throw new Error('Captured image blob is empty.');
      }

      const objectUrl = URL.createObjectURL(blob);
      setLatestObjectUrl(objectUrl);
      setLatestFilename(filename);

      setIsAnalyzing(true);
      const aiResults = await runLocalAI(blob);

      const timestamp = new Date().toISOString();
      const record: AnalysisRecord = {
        ID: createRecordId(),
        ImageURL: await blobToDataURL(blob),
        Timestamp: timestamp,
        DateGroup: buildDateGroupLabel(timestamp),
        Results: aiResults,
        IsEditedByDoctor: false,
        GeneratedFilename: filename,
      };

      setLatestCapturedAt(timestamp);
      onCaptureComplete(record);
    },
    [onCaptureComplete],
  );

  const handlePiCapture = async (): Promise<void> => {
    setCaptureError(null);
    setAcquireLabel('Downloading HD sample from Raspberry Pi...');
    setIsAcquiring(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(captureEndpoint, {
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        let serverMessage = `Capture failed with HTTP ${response.status}.`;
        try {
          const payload = (await response.json()) as { message?: string };
          if (payload?.message) {
            serverMessage = payload.message;
          }
        } catch {
          // Ignore JSON parsing failures.
        }

        throw new Error(serverMessage);
      }

      const blob = await response.blob();
      const filename = parseGeneratedFilename(response.headers);
      await processBlobPipeline(blob, filename);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setCaptureError('Raspberry Pi capture timed out.');
      } else {
        setCaptureError(error instanceof Error ? error.message : 'Unexpected Raspberry Pi capture error.');
      }
    } finally {
      window.clearTimeout(timeout);
      setIsAcquiring(false);
      setIsAnalyzing(false);
    }
  };

  const handlePhoneCapture = async (): Promise<void> => {
    if (!videoRef.current || !canvasRef.current) {
      setCaptureError('Phone camera is not ready.');
      return;
    }

    setCaptureError(null);
    setAcquireLabel('Capturing frame from local camera...');
    setIsAcquiring(true);

    try {
      const blob = await captureFrameFromVideo(videoRef.current, canvasRef.current);
      const filename = `phone_capture_${Date.now()}.jpg`;
      await processBlobPipeline(blob, filename);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Failed to capture from phone camera.');
    } finally {
      setIsAcquiring(false);
      setIsAnalyzing(false);
    }
  };

  const handleZoomChange = async (newValue: number): Promise<void> => {
    setZoomValue(newValue);

    const track = phoneStreamRef.current?.getVideoTracks()[0];
    if (!track) {
      return;
    }

    try {
      await track.applyConstraints({ advanced: [{ zoom: newValue } as any] });
    } catch (error) {
      console.warn('Failed to apply camera zoom constraint', error);
    }
  };

  const openGalleryPicker = (): void => {
    fileInputRef.current?.click();
  };

  const handleGalleryFileSelected = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setCaptureError(null);
    setAcquireLabel('Preparing gallery image...');
    setIsAcquiring(true);

    try {
      await processBlobPipeline(file, file.name || `gallery_capture_${Date.now()}.jpg`);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Failed to process gallery image.');
    } finally {
      setIsAcquiring(false);
      setIsAnalyzing(false);
    }
  };

  const discardLatestPreview = (): void => {
    if (latestObjectUrl) {
      URL.revokeObjectURL(latestObjectUrl);
    }

    setLatestObjectUrl(null);
    setLatestFilename(null);
    setLatestCapturedAt(null);
  };

  const isBusy = isAcquiring || isAnalyzing || isPhoneCameraStarting;
  const healthLabel =
    healthStatus === 'online'
      ? 'System Online'
      : healthStatus === 'offline'
        ? 'Microscope Disconnected'
        : 'Checking System...';
  const healthDotClass =
    healthStatus === 'online'
      ? 'bg-emerald-500'
      : healthStatus === 'offline'
        ? 'bg-rose-500'
        : 'bg-amber-400';

  const renderCapturePanel = (): React.ReactNode => {
    if (captureMode === 'pi') {
      return (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <img
              src={streamEndpoint}
              alt="Microscope MJPEG stream"
              onError={() => setPiStreamError(true)}
              onLoad={() => setPiStreamError(false)}
              className="h-[52vh] min-h-[280px] w-full object-cover"
            />

            {piStreamError && !isBusy && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-6 text-center">
                <TriangleAlert className="h-8 w-8 text-amber-300" />
                <p className="text-sm text-amber-100">Pi stream unavailable. Switch to Local Camera or Gallery mode.</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handlePiCapture}
            disabled={isBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-800/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Microscope size={18} />
            Capture HD from Raspberry Pi
          </button>
        </div>
      );
    }

    if (captureMode === 'phone') {
      return (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <video ref={videoRef} autoPlay playsInline muted className="h-[52vh] min-h-[280px] w-full object-cover" />

            {(phoneCameraError || isPhoneCameraStarting) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/85 px-6 text-center">
                {isPhoneCameraStarting ? (
                  <>
                    <LoaderCircle className="h-8 w-8 animate-spin text-cyan-300" />
                    <p className="text-sm text-cyan-100">Starting rear camera...</p>
                  </>
                ) : (
                  <>
                    <TriangleAlert className="h-8 w-8 text-amber-300" />
                    <p className="text-sm text-amber-100">{phoneCameraError}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {zoomSupported && (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-800">
                <ZoomIn size={14} />
                Camera Zoom
              </div>
              <input
                type="range"
                min={zoomMin}
                max={zoomMax}
                step={zoomStep}
                value={zoomValue}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  void handleZoomChange(value);
                }}
                className="w-full accent-cyan-600"
              />
              <p className="mt-1 text-xs text-cyan-700">{zoomValue.toFixed(2)}x</p>
            </div>
          )}

          <button
            type="button"
            onClick={handlePhoneCapture}
            disabled={isBusy || !!phoneCameraError}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-800/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera size={18} />
            Capture from Phone Camera
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex h-[52vh] min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 px-6 text-center">
          <Upload className="mb-3 h-10 w-10 text-cyan-600" />
          <h3 className="text-base font-semibold text-slate-900">Upload from Gallery</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Import an existing microscope image from local storage and run the same AI analysis pipeline.
          </p>
        </div>

        <button
          type="button"
          onClick={openGalleryPicker}
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-800/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={18} />
          Upload from Gallery
        </button>
      </div>
    );
  };

  return (
    <section className="relative rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-xl backdrop-blur-sm sm:p-6">
      <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${healthDotClass} ${healthStatus === 'checking' ? 'animate-pulse' : ''}`} />
        {healthLabel}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="false"
        className="hidden"
        onChange={(event) => {
          void handleGalleryFileSelected(event);
        }}
      />

      <canvas ref={canvasRef} className="hidden" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Microscope Capture Console</h2>
          <p className="text-xs text-slate-500">Select source mode. All modes feed one secure Blob analysis pipeline.</p>
        </div>
        {latestCapturedAt && (
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={14} />
            Last capture {new Date(latestCapturedAt).toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setCaptureMode('pi')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
            captureMode === 'pi' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'
          }`}
        >
          <Microscope size={16} />
          Pi Stream
        </button>

        <button
          type="button"
          onClick={() => setCaptureMode('phone')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
            captureMode === 'phone' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'
          }`}
        >
          <Camera size={16} />
          Phone Camera
        </button>

        <button
          type="button"
          onClick={() => setCaptureMode('gallery')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
            captureMode === 'gallery' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'
          }`}
        >
          <Upload size={16} />
          Gallery
        </button>
      </div>

      <div className="relative transition-all duration-300">{renderCapturePanel()}</div>

      {(isAcquiring || isAnalyzing) && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur-sm">
          <LoaderCircle className="h-12 w-12 animate-spin text-emerald-300" />
          <p className="text-sm font-medium text-emerald-50">{isAcquiring ? acquireLabel : 'Running on-device AI inference...'}</p>
        </div>
      )}

      {captureError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{captureError}</div>}

      {latestObjectUrl && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-600">Latest local preview ({latestFilename ?? 'image.png'})</p>
            <button
              type="button"
              onClick={discardLatestPreview}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <Trash2 size={13} />
              Discard
            </button>
          </div>
          <img src={latestObjectUrl} alt="Latest local capture preview" className="h-40 w-full rounded-xl object-cover sm:h-48" />
        </div>
      )}
    </section>
  );
};

export default MicroscopeView;
