import React from 'react';

export default function DocumentCard({ children, className = '' }) {
  return (
    <div
      className={`mx-auto flex min-h-[800px] w-full max-w-5xl flex-col rounded-[24px] border border-document-border bg-document-canvas shadow-sm ${className}`}
    >
      <div className="flex flex-1 flex-col p-6 sm:p-8 lg:p-10">{children}</div>
    </div>
  );
}
