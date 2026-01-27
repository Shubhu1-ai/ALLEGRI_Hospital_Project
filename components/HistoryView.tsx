import React, { useState, useMemo } from 'react';
import { ArrowLeft, Search, Microscope, Calendar, Trash2, CheckCircle, Clock, AlertCircle, Plus, Download } from 'lucide-react';
import { AnalysisResult } from '../types';

interface HistoryViewProps {
  results: AnalysisResult[];
  onBack: () => void;
  onClearHistory: () => void;
  onDeleteHistory: (ids: string[]) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ results, onBack, onClearHistory, onDeleteHistory }) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [correctedIds, setCorrectedIds] = useState<Set<string>>(new Set());

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      if (filter === 'all') return true;
      return result.status === filter;
    });
  }, [results, filter]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': 
        return { 
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200', 
          icon: <CheckCircle size={12} className="mr-1" />,
          label: 'Completed'
        };
      case 'pending': 
        return { 
          color: 'bg-amber-100 text-amber-800 border-amber-200', 
          icon: <Clock size={12} className="mr-1" />,
          label: 'Pending'
        };
      case 'failed': 
        return { 
          color: 'bg-red-100 text-red-800 border-red-200', 
          icon: <AlertCircle size={12} className="mr-1" />,
          label: 'Failed'
        };
      default: 
        return { 
          color: 'bg-slate-100 text-slate-800 border-slate-200', 
          icon: null,
          label: status
        };
    }
  };

  const handleClearAllClick = () => {
    if (results.length === 0) return;
    if (window.confirm("CRITICAL: Throw ALL records into garbage and wipe from memory? This is irreversible.")) {
      const allIds = results.map(r => r.id);
      setDeletingIds(new Set(allIds));
      
      setTimeout(() => {
        onClearHistory();
        setSelectedIds(new Set());
        setDeletingIds(new Set());
      }, 500);
    }
  };

  const handleDeleteSelected = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.size === 0) return;
    if (window.confirm(`Throw ${selectedIds.size} selected records into garbage?`)) {
      const idsToThrow = Array.from(selectedIds);
      setDeletingIds(prev => new Set([...prev, ...idsToThrow]));
      
      setTimeout(() => {
        onDeleteHistory(idsToThrow);
        setSelectedIds(new Set());
        setDeletingIds(prev => {
          const next = new Set(prev);
          idsToThrow.forEach(id => next.delete(id));
          return next;
        });
      }, 400);
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAllFiltered = () => {
    const newSet = new Set(selectedIds);
    filteredResults.forEach(r => newSet.add(r.id));
    setSelectedIds(newSet);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const isDeletingSomething = deletingIds.size > 0;

  const toggleCorrection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCorrectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadImage = (dataUrl: string, filename?: string) => {
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename || 'analysis.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 animate-in fade-in duration-300 mb-10">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center">
            <button onClick={onBack} className="p-3 mr-4 text-slate-500 hover:bg-slate-200 rounded-2xl transition-all">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Analysis Records</h2>
              <div className="flex items-center text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider">
                <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px] mr-2">{results.length} Total</span>
                Lab Diagnostics DB
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            {selectedIds.size > 0 && (
              <button 
                onClick={handleDeleteSelected}
                disabled={isDeletingSomething}
                className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white hover:bg-red-700 rounded-2xl transition-all font-bold shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 group"
              >
                <Trash2 size={18} className={isDeletingSomething ? "animate-bounce" : ""} />
                <span>Selected Delete ({selectedIds.size})</span>
              </button>
            )}
            
            {results.length > 0 && (
              <button 
                onClick={handleClearAllClick}
                disabled={isDeletingSomething}
                className="flex items-center gap-2 px-5 py-3 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all font-bold shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Trash2 size={18} className="text-slate-400" />
                <span>Remove All</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
            {(['all', 'completed', 'pending', 'failed'] as const).map((f) => (
               <button
                 key={f}
                 onClick={() => setFilter(f)}
                 className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                   filter === f 
                     ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' 
                     : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                 }`}
               >
                 {f}
               </button>
            ))}
          </div>

          <div className="flex gap-3 px-2">
            <button onClick={selectAllFiltered} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:underline">Select Current</button>
            <button onClick={deselectAll} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:underline">Clear Selection</button>
          </div>
        </div>
      </div>

      {filteredResults.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-3xl shadow-sm border border-slate-100 animate-in zoom-in duration-300">
          <div className="bg-slate-50 h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="text-slate-300" size={48} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">No Matching Diagnostics</h3>
          <p className="text-slate-500 mt-2 font-medium max-w-xs mx-auto">
            {results.length === 0 
              ? "The diagnostic history is empty. Use the camera to start analysis." 
              : `Found zero records matching the "${filter}" filter criteria.`}
          </p>
          {results.length > 0 && (
            <button onClick={() => setFilter('all')} className="mt-8 text-emerald-600 font-bold hover:underline">Show All Records</button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredResults.slice().reverse().map((result) => {
            const status = getStatusBadge(result.status);
            const isSelected = selectedIds.has(result.id);
            const isDeleting = deletingIds.has(result.id);
            
            return (
              <div 
                key={result.id} 
                className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden hover:shadow-xl transition-all duration-400 relative cursor-pointer group flex h-40 ${
                  isDeleting ? 'scale-50 -rotate-6 opacity-0 translate-y-20' : 'scale-100 rotate-0 opacity-100'
                } ${isSelected ? 'border-emerald-500 ring-4 ring-emerald-500/5' : 'border-white hover:border-slate-200'}`}
                onClick={(e) => !isDeleting && toggleSelection(result.id, e)}
              >
                <div className={`absolute top-4 left-4 z-20 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-white/80 border-slate-300 group-hover:border-emerald-400 backdrop-blur-sm'}`}>
                   {isSelected && <CheckCircle size={14} />}
                </div>

                <div className={`absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm flex items-center ${status.color}`}>
                  {status.icon}
                  {status.label}
                </div>

                <div className="w-2/5 bg-slate-100 relative h-full">
                  <img src={result.imageUrl} alt="Bacteria Sample" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" />
                  <div className="absolute top-3 left-3 flex gap-2 z-20">
                    <button onClick={(e) => toggleCorrection(result.id, e)} title="Mark/Unmark Correction" className={`p-2 rounded-lg text-white ${correctedIds.has(result.id) ? 'bg-indigo-600' : 'bg-indigo-500/20 hover:bg-indigo-500 text-indigo-50'}`}>
                      <Plus size={14} />
                    </button>
                    <button onClick={() => downloadImage(result.imageUrl, `analysis-${result.id}.jpg`)} title="Download Image" className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-white">
                      <Download size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="w-3/5 p-5 pl-6 flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-slate-800 text-lg leading-tight mb-1 line-clamp-1 group-hover:text-emerald-700 transition-colors uppercase tracking-tight">
                      {result.bacteriaType}
                    </h4>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${result.confidence > 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: `${result.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 whitespace-nowrap">
                        {result.confidence}% CONF.
                      </span>
                    </div>

                    <div className="flex items-center text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">
                      <Calendar size={12} className="mr-1.5" />
                      {new Date(result.timestamp).toLocaleDateString()} @ {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">
                      <Microscope size={14} className="mr-1.5" />
                      <span>ALLEGRI PI</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryView;