import React from 'react';

export default function CapsuleTabs({ tabs, activeTabId, onTabChange, className = '' }) {
  return (
    <div className={`inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${
              isActive
                ? 'cursor-default border border-slate-200/80 bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-700'
            }`}
          >
            {tab.icon ? <span className="shrink-0">{tab.icon}</span> : null}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
