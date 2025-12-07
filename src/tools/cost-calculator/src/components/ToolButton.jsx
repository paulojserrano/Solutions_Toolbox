import React from 'react';

const ToolButton = ({ active, onClick, icon, label }) => {
  return (
    <button onClick={onClick} className={`relative group p-3 rounded-xl transition-all duration-200 ${active ? 'bg-blue-100 text-blue-600 shadow-inner' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`} title={label}>
      {icon} <span className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">{label}</span>
    </button>
  );
};

export default ToolButton;