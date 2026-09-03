import React, { useState } from 'react';
import Header from './components/Header';
import CameraView from './components/CameraView';
import HistoryView from './components/HistoryView';
import PatientHistoryView from './components/PatientHistoryView';
import NetworkSettings from './components/NetworkSettings';
import { UserProfile, AnalysisResult } from './types';
import { Camera, ClipboardList, UserCircle, HelpCircle, MessageCircle, ChevronRight, BookOpen, AlertTriangle } from 'lucide-react';
import allegriLogo from './src/assets/allegri-logo.jpeg';

enum ViewState {
  DASHBOARD = 'DASHBOARD',
  CAMERA = 'CAMERA',
  HISTORY = 'HISTORY',
  PATIENT_HISTORY = 'PATIENT_HISTORY',
  PROFILE = 'PROFILE'
}

const KIOSK_USER: UserProfile = {
  username: 'Device',
  role: 'admin',
  department: 'Kiosk',
  avatarUrl: '',
};

interface AllegriHospitalAppProps {
  user: UserProfile;
}

const isBrowserDataUrl = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().toLowerCase().startsWith('data:');

const AllegriHospitalApp: React.FC<AllegriHospitalAppProps> = ({ user }) => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const handleAnalysisComplete = (results: AnalysisResult[]) => {
    setAnalysisHistory((prev) => [...prev, ...results]);
    setView(ViewState.HISTORY);
  };

  const handleClearHistory = () => {
    setAnalysisHistory([]);
  };

  const handleDeleteHistory = (ids: string[]) => {
    setAnalysisHistory((prev) => prev.filter((item) => !ids.includes(item.id)));
  };

  const handleSaveCopy = (copy: AnalysisResult) => {
    if (
      isBrowserDataUrl(copy.imageUrl)
      || isBrowserDataUrl(copy.annotatedImageUrl)
      || isBrowserDataUrl(copy.originalImageUrl)
    ) {
      return;
    }

    const normalizedCopy: AnalysisResult = {
      ...copy,
      imageUrl: copy.originalImageUrl || copy.imageUrl,
    };

    setAnalysisHistory((prev) => [...prev, normalizedCopy]);
  };

  const renderContent = () => {
    switch (view) {
      case ViewState.CAMERA:
        return (
          <CameraView
            onBack={() => setView(ViewState.DASHBOARD)}
            onAnalysisComplete={handleAnalysisComplete}
            existingSampleNames={analysisHistory
              .map((result) => result.imageName)
              .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)}
          />
        );

      case ViewState.HISTORY:
        return (
          <HistoryView
            results={analysisHistory}
            onBack={() => setView(ViewState.DASHBOARD)}
            onClearHistory={handleClearHistory}
            onDeleteHistory={handleDeleteHistory}
            onSaveCopy={handleSaveCopy}
          />
        );

      case ViewState.PATIENT_HISTORY:
        return (
          <PatientHistoryView
            onBack={() => setView(ViewState.DASHBOARD)}
            onSaveCopy={handleSaveCopy}
          />
        );

      case ViewState.PROFILE:
        return (
          <div className="max-w-md mx-auto p-8 bg-white rounded-3xl shadow-2xl mt-12 animate-in fade-in zoom-in duration-300 border border-slate-100">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-32 w-32 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6 shadow-inner border-4 border-white">
                  <UserCircle size={80} />
                </div>
                <div className="absolute bottom-6 right-0 h-8 w-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                  <div className="h-2 w-2 bg-white rounded-full animate-ping"></div>
                </div>
              </div>

              <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">{user.username}</h2>
              <p className="text-emerald-600 font-black text-xs uppercase tracking-[0.2em] mt-2">{user.role}</p>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{user.department || 'General'}</p>

              <div className="w-full mt-10 space-y-4">
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                        <HelpCircle size={20} />
                      </div>
                      <span className="font-bold text-slate-700 tracking-tight">System Troubleshooting</span>
                    </div>
                    <ChevronRight size={20} className={`text-slate-400 transition-transform duration-300 ${showHelp ? 'rotate-90' : ''}`} />
                  </button>

                  {showHelp && (
                    <div className="p-6 bg-white text-sm text-slate-600 space-y-4 border-t border-slate-50 animate-in slide-in-from-top-4 duration-300">
                      <div className="flex gap-4 items-start">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-800 mb-1">Camera Permission</p>
                          <p className="text-xs leading-relaxed">Ensure browser site permissions are enabled. If the preview is black, refresh the browser.</p>
                        </div>
                      </div>
                      <div className="flex gap-4 items-start">
                        <BookOpen size={18} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-800 mb-1">Pi Analysis Interface</p>
                          <p className="text-xs leading-relaxed">Images are sent directly to the standalone Raspberry Pi AI backend at `http://192.168.137.188:8000`.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button className="w-full flex items-center justify-between p-5 border border-slate-100 rounded-3xl hover:bg-slate-50 transition-all shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                      <MessageCircle size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-slate-700">Contact IT Support</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">support@allegri.health</span>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setView(ViewState.DASHBOARD)}
                className="mt-8 text-xs font-black text-slate-400 hover:text-emerald-600 uppercase tracking-[0.2em] transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        );

      case ViewState.DASHBOARD:
      default:
        return (
          <div className="max-w-7xl mx-auto px-6 sm:px-10 py-12">
            <div className="mb-12">
              <div className="flex items-center gap-3">
                <img src={allegriLogo} alt="ALLEGRI logo" className="h-11 w-auto object-contain" />
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">ALLEGRI Dashboard</h1>
              </div>
              <p className="text-slate-500 font-medium mt-1">Authorized Medical Interface - Diagnostic Level Access</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              <button
                onClick={() => setView(ViewState.CAMERA)}
                className="group relative overflow-hidden bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 hover:shadow-2xl hover:border-emerald-200 hover:-translate-y-2 transition-all duration-500 text-left"
              >
                <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
                  <Camera size={200} className="text-emerald-500" />
                </div>
                <div className="h-16 w-16 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 mb-8 shadow-sm group-hover:scale-110 transition-transform">
                  <Camera size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Capture Sample</h3>
                <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed">
                  Initiate the Raspberry Pi live camera interface for multi-sample acquisition and AI analysis.
                </p>
                <div className="mt-8 flex items-center text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                  Open Camera Module <ChevronRight size={14} className="ml-1 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => setView(ViewState.HISTORY)}
                className="group relative overflow-hidden bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 hover:shadow-2xl hover:border-blue-200 hover:-translate-y-2 transition-all duration-500 text-left"
              >
                <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
                  <ClipboardList size={200} className="text-blue-500" />
                </div>
                <div className="h-16 w-16 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 mb-8 shadow-sm group-hover:scale-110 transition-transform">
                  <ClipboardList size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Calculation & Results</h3>
                <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed">
                  Review local analysis results, delete old records, and create doctor-edited copies.
                </p>
                <div className="mt-8 flex items-center text-blue-600 font-black text-[10px] uppercase tracking-widest">
                  View Data Logs <ChevronRight size={14} className="ml-1 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => setView(ViewState.PATIENT_HISTORY)}
                className="group relative overflow-hidden bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 hover:shadow-2xl hover:border-cyan-200 hover:-translate-y-2 transition-all duration-500 text-left"
              >
                <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
                  <BookOpen size={200} className="text-cyan-500" />
                </div>
                <div className="h-16 w-16 bg-cyan-100 rounded-3xl flex items-center justify-center text-cyan-600 mb-8 shadow-sm group-hover:scale-110 transition-transform">
                  <BookOpen size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Patient History</h3>
                <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed">
                  Fetch saved diagnostics from the Raspberry Pi backend and open any historical case in the doctor override modal.
                </p>
                <div className="mt-8 flex items-center text-cyan-600 font-black text-[10px] uppercase tracking-widest">
                  Browse Historical Cases <ChevronRight size={14} className="ml-1 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>
            </div>

            <div className="mt-10 max-w-md">
              <NetworkSettings />
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setView(ViewState.PROFILE)}
                className="px-6 py-2 bg-slate-200/50 hover:bg-slate-200 text-[10px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-[0.25em] rounded-full transition-all"
              >
                System Preferences & Profile
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Header
        user={user}
        onProfileClick={() => setView(ViewState.PROFILE)}
      />
      <main className="pb-10">
        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => <AllegriHospitalApp user={KIOSK_USER} />;

export default App;
