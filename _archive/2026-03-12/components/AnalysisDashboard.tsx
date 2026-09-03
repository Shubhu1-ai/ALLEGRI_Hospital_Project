import React, { useMemo, useState } from 'react';
import { CircleHelp, FilePenLine, Plus, Save, Trash2, X } from 'lucide-react';
import { AnalysisRecord, BacteriaResult } from '../types';

interface AnalysisDashboardProps {
  records: AnalysisRecord[];
  onSaveCorrectedAnalysis: (recordId: string, correctedResults: BacteriaResult[]) => void;
}

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

const formatTimestamp = (timestampIso: string): string =>
  new Date(timestampIso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ records, onSaveCorrectedAnalysis }) => {
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<BacteriaResult[]>([]);
  const [activeInfoRecord, setActiveInfoRecord] = useState<AnalysisRecord | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const groupedRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
    const groups = new Map<string, AnalysisRecord[]>();

    for (const record of sorted) {
      const label = buildDateGroupLabel(record.Timestamp);
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)?.push(record);
    }

    return Array.from(groups.entries());
  }, [records]);

  const startEditing = (record: AnalysisRecord): void => {
    setEditingRecordId(record.ID);
    setDraftRows(record.Results.map((row) => ({ ...row })));
    setSaveError(null);
  };

  const cancelEditing = (): void => {
    setEditingRecordId(null);
    setDraftRows([]);
    setSaveError(null);
  };

  const updateDraftField = (index: number, field: keyof BacteriaResult, value: string): void => {
    setDraftRows((previous) =>
      previous.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        if (field === 'Name') {
          return { ...row, Name: value };
        }

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return row;
        }

        return { ...row, [field]: numericValue };
      }),
    );
  };

  const addDraftRow = (): void => {
    setDraftRows((previous) => [
      ...previous,
      {
        Name: '',
        Count: 1,
        AccuracyPercentage: 90,
      },
    ]);
  };

  const removeDraftRow = (index: number): void => {
    setDraftRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
  };

  const saveDraft = (): void => {
    if (!editingRecordId) {
      return;
    }

    if (draftRows.length === 0) {
      setSaveError('At least one bacteria row is required before saving.');
      return;
    }

    const sanitizedRows: BacteriaResult[] = draftRows.map((row) => ({
      Name: row.Name.trim(),
      Count: Math.max(0, Math.round(row.Count)),
      AccuracyPercentage: Number(row.AccuracyPercentage.toFixed(2)),
    }));

    const invalidName = sanitizedRows.find((row) => row.Name.length === 0);
    if (invalidName) {
      setSaveError('Every bacteria row must include a valid Name.');
      return;
    }

    const invalidAccuracy = sanitizedRows.find(
      (row) => !Number.isFinite(row.AccuracyPercentage) || row.AccuracyPercentage < 0 || row.AccuracyPercentage > 100,
    );

    if (invalidAccuracy) {
      setSaveError('AccuracyPercentage must be between 0 and 100.');
      return;
    }

    onSaveCorrectedAnalysis(editingRecordId, sanitizedRows);
    setEditingRecordId(null);
    setDraftRows([]);
    setSaveError(null);
  };

  if (records.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200/70 bg-white/85 p-8 text-center shadow-xl backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-slate-900">Advanced Results Dashboard</h2>
        <p className="mt-2 text-sm text-slate-500">No captures yet. Start from the microscope view to generate the first analysis.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-xl backdrop-blur-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Advanced Results Dashboard</h2>
        <p className="text-xs text-slate-500">Grouped by clinical capture date with doctor correction controls.</p>
      </div>

      {groupedRecords.map(([dateGroup, groupRecords]) => (
        <div key={dateGroup} className="space-y-4">
          <h3 className="sticky top-2 z-10 inline-flex rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold tracking-wide text-slate-100 shadow-lg">
            {dateGroup}
          </h3>

          <div className="space-y-4">
            {groupRecords.map((record) => {
              const isEditing = editingRecordId === record.ID;
              const rows = isEditing ? draftRows : record.Results;

              return (
                <article
                  key={record.ID}
                  className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-300/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={record.ImageURL} alt="Analyzed sample" className="h-12 w-12 rounded-xl object-cover" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Capture ID: {record.ID.slice(0, 8)}</p>
                        <p className="text-xs text-slate-500">{formatTimestamp(record.Timestamp)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                          record.IsEditedByDoctor ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {record.IsEditedByDoctor ? 'Doctor Edited' : 'AI Default'}
                      </span>

                      <button
                        type="button"
                        onClick={() => setActiveInfoRecord(record)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        <CircleHelp size={14} />
                        Info
                      </button>

                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => startEditing(record)}
                          className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100"
                        >
                          <FilePenLine size={14} />
                          Edit Mode
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto px-4 py-4">
                    <table className="min-w-full table-fixed border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                          <th className="pb-2 pr-3">Bacteria Name</th>
                          <th className="pb-2 pr-3">Count</th>
                          <th className="pb-2 pr-3">Accuracy %</th>
                          {isEditing && <th className="pb-2 pr-3">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={`${record.ID}-${index}`} className="border-b border-slate-100 text-sm text-slate-700">
                            <td className="py-2 pr-3 align-middle">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={row.Name}
                                  onChange={(event) => updateDraftField(index, 'Name', event.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                row.Name
                              )}
                            </td>
                            <td className="py-2 pr-3 align-middle">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={row.Count}
                                  onChange={(event) => updateDraftField(index, 'Count', event.target.value)}
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                row.Count
                              )}
                            </td>
                            <td className="py-2 pr-3 align-middle">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  value={row.AccuracyPercentage}
                                  onChange={(event) => updateDraftField(index, 'AccuracyPercentage', event.target.value)}
                                  className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                `${row.AccuracyPercentage.toFixed(2)}%`
                              )}
                            </td>
                            {isEditing && (
                              <td className="py-2 pr-3 align-middle">
                                <button
                                  type="button"
                                  onClick={() => removeDraftRow(index)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 transition hover:bg-rose-100"
                                >
                                  <Trash2 size={13} />
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {isEditing && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={addDraftRow}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Plus size={14} />
                          Add Bacteria Row
                        </button>

                        <button
                          type="button"
                          onClick={saveDraft}
                          className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500"
                        >
                          <Save size={14} />
                          Save Corrected Analysis
                        </button>
                      </div>

                      {saveError && <p className="text-xs text-rose-700">{saveError}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}

      {activeInfoRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" onClick={() => setActiveInfoRecord(null)}>
          <div
            onClick={(event) => event.stopPropagation()}
            className="animate-modal-slide w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-900">Capture Information</h4>
              <button
                type="button"
                onClick={() => setActiveInfoRecord(null)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Exact Timestamp</dt>
                <dd className="font-medium text-slate-900">{formatTimestamp(activeInfoRecord.Timestamp)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Generated Filename</dt>
                <dd className="break-all font-medium text-slate-900">{activeInfoRecord.GeneratedFilename}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
};

export default AnalysisDashboard;
