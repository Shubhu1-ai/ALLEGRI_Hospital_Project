export interface BacteriaResult {
  Name: string;
  Count: number;
  AccuracyPercentage: number;
}

export interface AnalysisRecord {
  ID: string;
  ImageURL: string;
  Timestamp: string;
  DateGroup: string;
  Results: BacteriaResult[];
  IsEditedByDoctor: boolean;
  GeneratedFilename: string;
}

// Legacy app types kept for compatibility with older components still present in the repository.
export interface UserProfile {
  username: string;
  role: string;
  department: string;
  avatarUrl: string;
}

export interface Prediction {
  name: string;
  confidence: number;
  count?: number;
}

export interface DetectionOverlay {
  box: [number, number, number, number];
  class_name: string;
  confidence: number;
}

export interface AnalysisResult {
  id: string;
  imageUrl: string;
  annotatedImageUrl?: string;
  originalImageUrl?: string;
  imageName?: string;
  timestamp: string;
  bacteriaType: string;
  // New YOLO11 mapping target while preserving compatibility with legacy confidence-based UI.
  accuracy: number;
  confidence: number;
  predictions?: Prediction[];
  detections?: DetectionOverlay[];
  detectionCount?: number;
  summary?: string;
  isEditedCopy?: boolean;
  isEditedByDoctor?: boolean;
  originalImageId?: string;
  remoteRecordId?: string;
  // Set after a successful POST /finalize — used as the Pi DB integer primary key.
  history_id?: number;
  // Original captured image Blob kept in memory so /finalize can re-upload it.
  // Never serialised; only lives for the duration of the analysis session.
  imageBlob?: Blob;
  source?: 'local' | 'patient-history';
  notes: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface PiResponse {
  success: boolean;
  data?: {
    identified_bacteria: string;
    confidence_score: number;
    analysis_time_ms: number;
  };
  error?: string;
}
