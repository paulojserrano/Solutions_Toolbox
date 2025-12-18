import React from 'react';
import { SplitSquareHorizontal, Trash2 } from 'lucide-react';
import { useScenario } from '../context/ScenarioContext';

export default function Header({ activeTab, setActiveTab, splitView, setSplitView, onClear }) {
  const { userInfo } = useScenario();

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0 w-full shadow-none">
        <div className="flex items-center gap-4">
           <a href="/index.html" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">E</div>
           </a>
           <h2 className="text-lg font-bold text-slate-800 tracking-tight">Cost per Unit Calculator</h2>
           <div className="h-4 w-px bg-slate-200"></div>
           <nav className="flex gap-1">
              <button onClick={() => setActiveTab('editor')} className={`main-tab-button ${activeTab === 'editor' ? 'active' : ''}`}>
                 Editor
              </button>
              <button onClick={() => setActiveTab('analysis')} className={`main-tab-button ${activeTab === 'analysis' ? 'active' : ''}`}>
                 Analysis
              </button>
              <button onClick={() => setActiveTab('settings')} className={`main-tab-button ${activeTab === 'settings' ? 'active' : ''}`}>
                 Settings
              </button>
              <button onClick={() => setActiveTab('json')} className={`main-tab-button ${activeTab === 'json' ? 'active' : ''}`}>
                 JSON
              </button>
           </nav>
        </div>
        <div className="flex items-center gap-3">
             <button onClick={() => setSplitView(!splitView)} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${splitView ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}>
                <SplitSquareHorizontal size={16}/> {splitView ? 'Single View' : 'Split View'}
             </button>
             <div className="h-6 w-px bg-slate-200 mx-2"></div>
             <button onClick={onClear} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /> Clear</button>
             <div className="h-6 w-px bg-slate-200 mx-2"></div>
             {userInfo ? (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                        {userInfo.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate max-w-[150px]">{userInfo.name}</p>
                        <a href="/.auth/logout" className="text-xs text-slate-500 hover:text-blue-400 transition-colors">Log out</a>
                    </div>
                </div>
             ) : (
                <div className="flex items-center gap-3 opacity-50">
                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">G</div>
                     <p className="text-sm font-medium text-slate-500">Guest</p>
                </div>
             )}
        </div>
      </header>
  );
}
