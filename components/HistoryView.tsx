import React, { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, PencilLine, Search, Trash2 } from 'lucide-react';
import { AnalysisResult } from '../types';
import DoctorOverrideModal, { DetectionImage, detectionsFromResult, getResultImageUrl } from './DoctorOverrideModal';

interface HistoryViewProps {
  results: AnalysisResult[];
  onBack: () => void;
  onClearHistory: () => void;
  onDeleteHistory: (ids: string[]) => void;
  onSaveCopy: (copy: AnalysisResult) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ results, onBack, onClearHistory, onDeleteHistory, onSaveCopy }) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<AnalysisResult | null>(null);

  const filteredResults = useMemo(
    () => results.filter((result) => (filter === 'all' ? true : result.status === filter)),
    [results, filter],
  );

  const openEditModal = (result: AnalysisResult) => {
    setEditTarget(result);
  };

  const deleteWithFade = (ids: string[]) => {
    if (ids.length === 0) return;
    setDeletingIds((prev) => new Set([...prev, ...ids]));
    window.setTimeout(() => {
      onDeleteHistory(ids);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 260);
  };

  return (
    <section className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-200">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-800">Medical Results</h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{results.length} total analysis records</p>
          </div>
        </div>

        {results.length > 0 && (
          <button
            onClick={onClearHistory}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            <Trash2 size={14} />
            Clear All
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        {(['all', 'completed', 'pending', 'failed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
              filter === status ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {filteredResults.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <Search size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-bold text-slate-700">No results available for this filter</p>
          <p className="mt-1 text-sm text-slate-500">Capture samples and run analysis to populate this view.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.slice().reverse().map((result) => {
            const detections = detectionsFromResult(result);
            const imageName = result.imageName || `Sample_${result.id.slice(0, 5)}`;
            const imageUrl = getResultImageUrl(result);

            return (
              <article
                key={result.id}
                className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 ${
                  deletingIds.has(result.id) ? 'translate-y-2 scale-[0.98] opacity-0' : 'translate-y-0 scale-100 opacity-100'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <DetectionImage
                      src={imageUrl}
                      alt={imageName}
                      detections={result.detections}
                      className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200"
                      imageClassName="h-full w-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-black text-slate-800">{imageName}</p>
                      <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <Calendar size={12} />
                        {new Date(result.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {result.isEditedCopy && (
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-700">
                        Edited Copy
                      </span>
                    )}
                    <button
                      onClick={() => openEditModal(result)}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <PencilLine size={14} />
                      Doctor Override
                    </button>
                    <button
                      onClick={() => deleteWithFade([result.id])}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Detection</th>
                        <th className="px-3 py-2">Bacteria Name</th>
                        <th className="px-3 py-2">Accuracy (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detections.length === 0 ? (
                        <tr className="border-t border-slate-100">
                          <td colSpan={3} className="px-3 py-3 text-xs text-slate-500">
                            No detections available for this sample.
                          </td>
                        </tr>
                      ) : (
                        detections.map((detection, index) => (
                          <tr key={`${result.id}-det-${index}-${detection.box.join('-')}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-semibold text-slate-700">#{index + 1}</td>
                            <td className="px-3 py-2 font-semibold text-slate-700">{detection.class_name}</td>
                            <td className="px-3 py-2 text-slate-700">{detection.confidence.toFixed(1)}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DoctorOverrideModal
        result={editTarget}
        onClose={() => setEditTarget(null)}
        onSaveCopy={onSaveCopy}
      />
    </section>
  );
};

export default HistoryView;
