import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import { AnalysisResult } from '../types';
import { deleteHistoryRecord, fetchPatientHistory } from '../services/piService';
import { PI_HISTORY_URL } from '../services/piConfig';
import DoctorOverrideModal, { DetectionImage, getResultImageUrl } from './DoctorOverrideModal';

interface PatientHistoryViewProps {
  onBack: () => void;
  onSaveCopy: (copy: AnalysisResult) => void;
}

const getCaseCountLabel = (result: AnalysisResult): string => {
  if (typeof result.detectionCount === 'number' && Number.isFinite(result.detectionCount)) {
    return `${result.detectionCount} finding${result.detectionCount === 1 ? '' : 's'}`;
  }

  const predictionCount = Array.isArray(result.predictions)
    ? result.predictions.reduce((total, prediction) => total + Math.max(1, Math.round(prediction.count ?? 1)), 0)
    : 0;

  return `${predictionCount} finding${predictionCount === 1 ? '' : 's'}`;
};

const PatientHistoryView: React.FC<PatientHistoryViewProps> = ({ onBack, onSaveCopy }) => {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const history = await fetchPatientHistory();
        if (!isMounted) {
          return;
        }

        setResults(history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load patient history.');
        setResults([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const subtitle = useMemo(() => {
    if (isLoading) {
      return 'Loading patient history from the Raspberry Pi...';
    }

    return `${results.length} saved case${results.length === 1 ? '' : 's'} available from the Pi backend`;
  }, [isLoading, results.length]);

  const handleDeleteRecord = async (result: AnalysisResult) => {
    // remoteRecordId is the Pi's original integer ID (e.g. "3").
    // If it is missing, readId() never found a valid ID field and result.id is a
    // random UUID fallback — sending that to the Pi would silently hit 0 rows.
    const piId = result.remoteRecordId;
    if (!piId) {
      const message = 'Cannot delete: this record has no Raspberry Pi ID. The Pi may have returned an unrecognised ID field.';
      console.error('[PatientHistoryView] Missing remoteRecordId for result', result.id);
      alert(message);
      setError(message);
      return;
    }

    if (deletingId || isLoading) {
      return;
    }

    setDeletingId(result.id);
    setError(null);

    try {
      await deleteHistoryRecord(piId);
      setResults((prev) => prev.filter((r) => r.id !== result.id));
      setSelectedResult((current) => current?.id === result.id ? null : current);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete patient history record.';
      console.error('[PatientHistoryView] Delete failed — piId:', piId, deleteError);
      alert(`Delete failed: ${message}`);
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-200">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-800">Patient History</h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white text-center">
          <LoaderCircle className="mb-3 h-10 w-10 animate-spin text-emerald-500" />
          <p className="text-base font-bold text-slate-800">Loading patient history</p>
          <p className="mt-1 text-sm text-slate-500">Fetching saved historical diagnostics from `{PI_HISTORY_URL}`.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-bold text-slate-700">No saved patient history available</p>
          <p className="mt-1 text-sm text-slate-500">Historical cases will appear here as a clickable thumbnail grid.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((result) => {
            const previewImageUrl = getResultImageUrl(result);
            const imageName = result.imageName || `Case_${result.id.slice(0, 5)}`;
            const isDeleting = deletingId === result.id;

            return (
              <article
                key={result.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => setSelectedResult(result)}
                  disabled={isDeleting}
                  className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <DetectionImage
                    src={previewImageUrl}
                    alt={imageName}
                    detections={result.detections}
                    className="h-44 w-full overflow-hidden border-b border-slate-200"
                    imageClassName="h-full w-full object-cover"
                  />
                  <div className="space-y-2 p-4">
                    <p className="truncate text-sm font-black text-slate-800">{imageName}</p>
                    <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Calendar size={12} />
                      {new Date(result.timestamp).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-bold uppercase tracking-wider">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{result.bacteriaType}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{getCaseCountLabel(result)}</span>
                    </div>
                  </div>
                </button>

                <div className="border-t border-slate-200 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteRecord(result);
                    }}
                    disabled={isDeleting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DoctorOverrideModal
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
        onSaveCopy={onSaveCopy}
      />
    </section>
  );
};

export default PatientHistoryView;
