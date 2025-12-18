import React from 'react';
import { MousePointer2, Hand, Circle, Square, ArrowRight } from 'lucide-react';
import ToolButton from './ToolButton';

export default function Sidebar({ tool, setTool, setConnectionStart }) {
  return (
    <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4 z-10 shadow-sm">
      <ToolButton active={tool === 'select'} onClick={() => { setTool('select'); setConnectionStart(null); }} icon={<MousePointer2 size={20} />} label="Select" />
      <ToolButton active={tool === 'hand'} onClick={() => setTool('hand')} icon={<Hand size={20} />} label="Pan" />
      <div className="w-8 h-px bg-slate-200 my-1"></div>
      <ToolButton active={tool === 'circle'} onClick={() => setTool('circle')} icon={<Circle size={20} />} label="Start/End" />
      <ToolButton active={tool === 'rect'} onClick={() => setTool('rect')} icon={<Square size={20} />} label="Process" />
      {/* Diamond Tool Removed per user directive */}
      <div className="w-8 h-px bg-slate-200 my-1"></div>
      <ToolButton active={tool === 'connect'} onClick={() => setTool('connect')} icon={<ArrowRight size={20} />} label="Connect" />
    </aside>
  );
}
