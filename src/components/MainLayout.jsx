import React from 'react';

export default function MainLayout({
  header,
  leftPanel,
  rightPanel,
  children,
  footerOverlay = null,
}) {
  return (
    <div className="no-print flex h-screen w-full overflow-hidden bg-document-bg font-sans text-slate-800 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="shrink-0">{header}</div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {leftPanel}

          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>

          {rightPanel}
        </div>
      </div>

      {footerOverlay}
    </div>
  );
}
