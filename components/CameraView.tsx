import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, AlertTriangle, ArrowLeft, Zap, Images, CheckCircle, X, Trash2, Maximize2, Crop, Plus, Download } from 'lucide-react';
import { analyzeImageWithPi } from '../services/piService';
import { AnalysisResult } from '../types';

interface CameraViewProps {
  onBack: () => void;
  onAnalysisComplete: (results: AnalysisResult[]) => void;
}

interface CapturedImage {
  id: string;
  url: string;
  selected: boolean;
}

interface ViewerTarget {
  id: string;
  url: string;
}

// Simple crop modal component
interface CropModalProps {
  image: CapturedImage;
  onConfirm: (id: string, newUrl: string) => void;
  onCancel: () => void;
}

const CropModal: React.FC<CropModalProps> = ({ image, onConfirm, onCancel }) => {
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setCurrentPos({ x, y });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleConfirm = () => {
    if (!imgRef.current) return;
    const naturalWidth = imgRef.current.naturalWidth;
    const clientWidth = imgRef.current.width;
    const scale = naturalWidth / clientWidth;

    const x = Math.min(startPos.x, currentPos.x) * scale;
    const y = Math.min(startPos.y, currentPos.y) * scale;
    const w = Math.abs(currentPos.x - startPos.x) * scale;
    const h = Math.abs(currentPos.y - startPos.y) * scale;

    if (w < 50 || h < 50) {
      alert("Selection too small. Please select a larger area.");
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(imgRef.current, x, y, w, h, 0, 0, w, h);
      onConfirm(image.id, canvas.toDataURL('image/jpeg'));
    }
  };

  const selectionStyle = {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y),
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg mb-4 flex justify-between items-center text-white">
        <h3 className="font-bold text-xl">Manual Crop</h3>
        <p className="text-sm text-slate-400">Select bacteria sample area</p>
      </div>
      
      <div 
        ref={containerRef}
        className="relative bg-black border border-slate-800 cursor-crosshair select-none touch-none shadow-2xl rounded-lg overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          ref={imgRef}
          src={image.url} 
          alt="To crop" 
          className="max-h-[60vh] max-w-full object-contain pointer-events-none"
        />
        <div 
          className="absolute border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
          style={{ ...selectionStyle, pointerEvents: 'none' }}
        />
      </div>

      <div className="mt-8 flex gap-4 w-full max-w-lg">
        <button 
          onClick={onCancel}
          className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors border border-slate-700"
        >
          Cancel
        </button>
        <button 
          onClick={handleConfirm}
          className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
        >
          Confirm Crop
        </button>
      </div>
    </div>
  );
};

const CameraView: React.FC<CameraViewProps> = ({ onBack, onAnalysisComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'camera' | 'review'>('camera');
  const [cropTarget, setCropTarget] = useState<CapturedImage | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null);
  const [correctingIds, setCorrectingIds] = useState<Set<string>>(new Set());

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      setError("Unable to access camera. Please check permissions.");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (viewMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [viewMode]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImages(prev => [
          ...prev, 
          { id: Date.now().toString() + Math.random().toString(), url: dataUrl, selected: true }
        ]);
      }
    }
  }, []);

  const toggleImageSelection = (id: string) => {
    setCapturedImages(prev => prev.map(img => 
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const openViewer = (img: CapturedImage) => {
    setViewerTarget({ id: img.id, url: img.url });
  };

  const closeViewer = () => setViewerTarget(null);

  const toggleCorrection = (id: string) => {
    setCorrectingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadImage = (dataUrl: string, filename?: string) => {
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename || 'image.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const deleteImage = (id: string, e?: React.MouseEvent) => {
     if (e) e.stopPropagation();
     if(window.confirm("Throw this sample into garbage?")) {
        setDeletingIds(prev => new Set(prev).add(id));
        setTimeout(() => {
          setCapturedImages(prev => prev.filter(img => img.id !== id));
          setDeletingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 400);
     }
  };
  
  const deleteSelectedImages = () => {
    const selected = capturedImages.filter(img => img.selected);
    if (selected.length === 0) return;
    
    if(window.confirm(`Throw ${selected.length} selected samples into garbage?`)) {
      const idsToDelete = new Set(selected.map(img => img.id));
      setDeletingIds(prev => new Set([...prev, ...idsToDelete]));
      
      setTimeout(() => {
        setCapturedImages(prev => prev.filter(img => !idsToDelete.has(img.id)));
        setDeletingIds(prev => {
          const next = new Set(prev);
          idsToDelete.forEach(id => next.delete(id));
          return next;
        });
      }, 400);
    }
  };

  const clearAllImages = () => {
    if (capturedImages.length === 0) return;
    if(window.confirm("Empty the entire gallery and throw ALL samples into garbage?")) {
      const allIds = capturedImages.map(img => img.id);
      setDeletingIds(new Set(allIds));
      
      setTimeout(() => {
        setCapturedImages([]);
        setDeletingIds(new Set());
        setViewMode('camera');
      }, 500);
    }
  };

  const selectAll = (select: boolean) => {
    setCapturedImages(prev => prev.map(img => ({ ...img, selected: select })));
  };

  const handleBatchAnalyze = async (analyzeAll: boolean) => {
    const imagesToProcess = analyzeAll 
      ? capturedImages 
      : capturedImages.filter(img => img.selected);

    if (imagesToProcess.length === 0) return;

    setIsAnalyzing(true);
    try {
      const promises = imagesToProcess.map(img => analyzeImageWithPi(img.url));
      const results = await Promise.all(promises);
      onAnalysisComplete(results);
    } catch (err) {
      setError("Connection to Raspberry Pi failed during batch analysis.");
      setIsAnalyzing(false);
    }
  };

  const openCropModal = (img: CapturedImage, e: React.MouseEvent) => {
    e.stopPropagation();
    setCropTarget(img);
  };

  const handleCropConfirm = (id: string, newUrl: string) => {
    setCapturedImages(prev => prev.map(img => 
      img.id === id ? { ...img, url: newUrl } : img
    ));
    setCropTarget(null);
  };

  if (viewMode === 'camera') {
    return (
      <div className="max-w-2xl mx-auto p-4 animate-in fade-in duration-300 flex flex-col h-[calc(100vh-5rem)]">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center">
              <button onClick={onBack} className="p-2 mr-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-xl font-bold text-slate-800">Sample Acquisition</h2>
           </div>
           {capturedImages.length > 0 && (
             <div className="bg-emerald-100 text-emerald-800 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm border border-emerald-200">
               {capturedImages.length} Samples Ready
             </div>
           )}
        </div>

        <div className="flex-1 bg-black rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-center border-4 border-slate-200">
          <canvas ref={canvasRef} className="hidden" />

          {error ? (
            <div className="text-center p-10 text-white">
              <div className="bg-yellow-500/10 p-6 rounded-full inline-block mb-4">
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              </div>
              <p className="text-lg font-medium">{error}</p>
              <button onClick={startCamera} className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-700 transition-all">
                Retry Connection
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
          
          <div className="absolute inset-0 pointer-events-none border border-white/10 grid grid-cols-3 grid-rows-3 opacity-20">
            <div className="border border-white/20"></div><div className="border border-white/20"></div><div className="border border-white/20"></div>
            <div className="border border-white/20"></div><div className="border border-white/20"></div><div className="border border-white/20"></div>
            <div className="border border-white/20"></div><div className="border border-white/20"></div><div className="border border-white/20"></div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center px-6 pb-6">
           <div className="w-24 flex justify-start">
             {capturedImages.length > 0 && (
               <button 
                 onClick={() => setViewMode('review')}
                 className="flex flex-col items-center gap-1 group"
               >
                 <div className="relative">
                    <img src={capturedImages[capturedImages.length-1].url} className="w-14 h-14 rounded-2xl border-2 border-white shadow-xl object-cover group-hover:scale-105 transition-transform" alt="last" />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-bold border-2 border-white shadow-md animate-in zoom-in">
                      {capturedImages.length}
                    </span>
                 </div>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Review</span>
               </button>
             )}
           </div>

           <div className="relative">
              <button
                onClick={capturePhoto}
                className="h-20 w-20 p-1.5 bg-white border-4 border-slate-200 rounded-full flex items-center justify-center shadow-2xl hover:border-emerald-500 active:scale-90 transition-all"
                aria-label="Capture Sample"
              >
                <div className="h-full w-full bg-emerald-500 rounded-full border-4 border-white shadow-inner"></div>
              </button>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capture</div>
           </div>

           <div className="w-24 flex justify-end">
              {capturedImages.length > 0 && (
                <button 
                  onClick={() => setViewMode('review')}
                  className="p-4 bg-emerald-600 text-white rounded-2xl shadow-xl hover:bg-emerald-700 hover:shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <CheckCircle size={28} />
                </button>
              )}
           </div>
        </div>
      </div>
    );
  }

  const selectedCount = capturedImages.filter(i => i.selected).length;
  const isDeletingSomething = deletingIds.size > 0;

  return (
    <div className="max-w-4xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-screen flex flex-col">
       {cropTarget && (
         <CropModal 
           image={cropTarget} 
           onConfirm={handleCropConfirm} 
           onCancel={() => setCropTarget(null)} 
         />
       )}

       {viewerTarget && (
         <div className="fixed inset-0 z-[250] bg-black/90 flex items-center justify-center p-4">
           <div className="w-full max-w-3xl bg-black rounded-lg overflow-hidden">
             <div className="p-3 flex justify-between items-center">
               <div className="text-white font-bold">Sample Viewer</div>
               <div className="flex gap-2">
                 <button onClick={() => downloadImage(viewerTarget.url, `sample-${viewerTarget.id}.jpg`)} className="text-white p-2 hover:text-emerald-400">
                   <Download />
                 </button>
                 <button onClick={() => { closeViewer(); }} className="text-white p-2 hover:text-slate-300">Close</button>
               </div>
             </div>
             <div className="p-4 flex items-center justify-center">
               <img src={viewerTarget.url} alt="viewer" className="max-h-[80vh] max-w-full object-contain" />
             </div>
           </div>
         </div>
       )}

       <div className="flex items-center justify-between mb-8">
          <button onClick={() => setViewMode('camera')} className="flex items-center text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors group">
             <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
             Return to Camera
          </button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sample Gallery</h2>
          <div className="w-20"></div> 
       </div>

       {isAnalyzing && (
          <div className="fixed inset-0 bg-slate-900/95 z-[200] flex flex-col items-center justify-center text-white backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative">
              <RefreshCw className="h-16 w-16 animate-spin text-emerald-400 mb-6" />
              <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400/50 h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Analyzing Bacteria Samples</h3>
            <p className="text-slate-400 font-medium">Connecting to ALLEGRI Raspberry Pi Cluster...</p>
          </div>
       )}

       <div className="flex-1 overflow-y-auto mb-24 px-1">
          <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 sticky top-0 z-10 flex-wrap gap-4">
             <div className="flex gap-4">
                <button onClick={() => selectAll(true)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">Select All</button>
                <button onClick={() => selectAll(false)} className="text-xs font-bold text-slate-500 hover:text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">Deselect All</button>
             </div>
             
             <div className="flex items-center gap-4">
               <span className="text-sm text-slate-600 font-bold bg-slate-100 px-3 py-1.5 rounded-lg">{selectedCount} Selected</span>
               <div className="flex gap-2">
                 {selectedCount > 0 && (
                   <button 
                     onClick={deleteSelectedImages} 
                     className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl border border-red-100 transition-all active:scale-95 group"
                   >
                     <Trash2 size={14} className={isDeletingSomething ? "animate-bounce" : ""} />
                     Throw to Garbage
                   </button>
                 )}
                 {capturedImages.length > 0 && (
                   <button 
                     onClick={clearAllImages} 
                     className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl border border-slate-200 transition-all active:scale-95"
                   >
                     <X size={14} />
                     Empty Gallery
                   </button>
                 )}
               </div>
             </div>
          </div>

          {capturedImages.length === 0 ? (
            <div className="text-center py-32 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
               <div className="bg-slate-100 p-8 rounded-full inline-block mb-6">
                 <Images size={64} className="text-slate-300" />
               </div>
               <h3 className="text-xl font-bold text-slate-700">Gallery Empty</h3>
               <p className="text-slate-400 mt-2 max-w-xs mx-auto">Take some photos of the samples to begin medical analysis.</p>
               <button onClick={() => setViewMode('camera')} className="mt-8 px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all">Launch Camera</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
               {capturedImages.map((img) => (
                 <div 
                   key={img.id} 
                   className={`relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 group ${
                     deletingIds.has(img.id) ? 'scale-0 rotate-12 opacity-0' : 'scale-100 rotate-0 opacity-100'
                   } ${img.selected ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-100 hover:border-slate-300'}`}
                   onClick={() => toggleImageSelection(img.id)}
                 >
                    <img src={img.url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="sample" />
                    
                    <div className={`absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center transition-all z-20 shadow-md ${img.selected ? 'bg-emerald-500 text-white' : 'bg-black/20 text-white border border-white/50 backdrop-blur-sm'}`}>
                       {img.selected ? <CheckCircle size={16} /> : <div className="h-4 w-4 rounded-full border-2 border-white/50" />}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                       <div className="flex justify-between items-center w-full">
                         <div className="flex gap-2">
                           <button 
                             onClick={(e) => openCropModal(img, e)}
                             className="bg-emerald-500/20 hover:bg-emerald-500 text-white p-2 rounded-xl backdrop-blur-md transition-all border border-emerald-400/30"
                             title="Crop Image"
                           >
                             <Crop size={18} />
                           </button>
                           <button 
                             onClick={(e) => toggleCorrection(img.id)}
                             className={`bg-indigo-500/10 hover:bg-indigo-500 text-white p-2 rounded-xl backdrop-blur-md transition-all border ${correctingIds.has(img.id) ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-indigo-200'}`}
                             title="Toggle Correction"
                           >
                             <Plus size={18} />
                           </button>
                           <button 
                             onClick={() => downloadImage(img.url, `sample-${img.id}.jpg`)}
                             className="bg-emerald-500/10 hover:bg-emerald-500 text-white p-2 rounded-xl backdrop-blur-md transition-all border border-emerald-300"
                             title="Download Image"
                           >
                             <Download size={18} />
                           </button>
                           <button 
                             onClick={(e) => deleteImage(img.id, e)}
                             className="bg-red-500/20 hover:bg-red-500 text-white p-2 rounded-xl backdrop-blur-md transition-all border border-red-400/30"
                             title="Throw into Garbage"
                           >
                             <Trash2 size={18} />
                           </button>
                         </div>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          )}
       </div>

       <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-6 shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.1)] z-40">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4">
             <button
               onClick={() => handleBatchAnalyze(false)}
               disabled={selectedCount === 0 || isAnalyzing || isDeletingSomething}
               className="flex-1 py-4 px-6 bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/10 hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
             >
               <Zap size={20} className="text-emerald-400" />
               Analyze Selected ({selectedCount})
             </button>

             <button
               onClick={() => handleBatchAnalyze(true)}
               disabled={capturedImages.length === 0 || isAnalyzing || isDeletingSomething}
               className="flex-1 py-4 px-6 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
             >
               <Maximize2 size={20} />
               Process Entire Gallery ({capturedImages.length})
             </button>
          </div>
       </div>
    </div>
  );
};

export default CameraView;