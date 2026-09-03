const DEFAULT_PI_IP = '192.168.137.47';

const getStoredPiIp = (): string => {
  try {
    return localStorage.getItem('PI_IP') || DEFAULT_PI_IP;
  } catch {
    return DEFAULT_PI_IP;
  }
};

/**
 * If the stored value is already a full URL (e.g. a Serveo or Ngrok tunnel
 * like https://abc.serveo.net), use it as-is — do NOT prepend http:// or
 * append a port number.
 * If it is a raw IP/hostname, wrap it with http:// and the given port.
 */
const buildBaseUrl = (stored: string, port: number): string => {
  const trimmed = stored.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, ''); // strip trailing slashes only
  }
  return `http://${trimmed}:${port}`;
};

const PI_STORED = getStoredPiIp();

export const PI_API_BASE_URL    = buildBaseUrl(PI_STORED, 8000);
export const PI_CAMERA_BASE_URL = buildBaseUrl(PI_STORED, 5000);

export const PI_ANALYZE_URL      = `${PI_API_BASE_URL}/analyze`;
export const PI_FINALIZE_URL     = `${PI_API_BASE_URL}/finalize`;
export const PI_HISTORY_URL      = `${PI_API_BASE_URL}/history`;
export const PI_CAMERA_STREAM_URL  = `${PI_CAMERA_BASE_URL}/flux`;
export const PI_CAMERA_CAPTURE_URL = `${PI_CAMERA_BASE_URL}/capturer`;
