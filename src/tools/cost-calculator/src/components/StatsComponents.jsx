import React from 'react';
import { BarChart2 } from 'lucide-react';

export const StatCard = ({ label, value, subtext, icon: Icon, colorClass = "text-slate-600" }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      {Icon && <Icon size={18} className={colorClass} opacity={0.8} />}
    </div>
    <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    {subtext && <div className="text-xs text-slate-400">{subtext}</div>}
  </div>
);

export const ProgressBar = ({ value, max, color = "bg-blue-500", label }) => (
  <div className="flex flex-col gap-1 w-full">
    <div className="flex justify-between text-xs font-medium">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${max > 0 ? (parseFloat(String(value).replace(/[^0-9.]/g,'')) / max) * 100 : 0}%` }}
      />
    </div>
  </div>
);

export const BarChart = ({ data, title, valueKey, labelKey, formatValue, color = "bg-blue-500" }) => {
  const max = Math.max(...data.map(d => d[valueKey]), 0);
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
        <BarChart2 size={16} /> {title}
      </h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 truncate max-w-[150px]">{item[labelKey]}</span>
              <span className="text-slate-800">{formatValue(item[valueKey])}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${max > 0 ? (item[valueKey] / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};