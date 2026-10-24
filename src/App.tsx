/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Download, 
  ExternalLink, 
  Layers, 
  Sparkles, 
  Code2, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown, 
  Play,
  FileCode,
  ShieldAlert
} from 'lucide-react';

export default function App() {
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleDownloadStandalone = () => {
    const link = document.createElement('a');
    link.href = '/DB2K-002.html';
    link.download = 'DB2K-002.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSampleReact = () => {
    try {
      const iframeWin = iframeRef.current?.contentWindow as any;
      if (iframeWin && typeof iframeWin.loadSampleReactProject === 'function') {
        iframeWin.loadSampleReactProject();
      } else {
        iframeRef.current?.contentWindow?.postMessage({ type: 'LOAD_SAMPLE_REACT' }, '*');
      }
    } catch (e) {
      console.warn('Could not trigger sample react project:', e);
    }
  };

  const handleLoadSampleHtml = () => {
    try {
      const iframeWin = iframeRef.current?.contentWindow as any;
      if (iframeWin && typeof iframeWin.loadSampleHtmlProject === 'function') {
        iframeWin.loadSampleHtmlProject();
      } else {
        iframeRef.current?.contentWindow?.postMessage({ type: 'LOAD_SAMPLE_HTML' }, '*');
      }
    } catch (e) {
      console.warn('Could not trigger sample html project:', e);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Engineering & Delivery Control Bar */}
      {!headerCollapsed && (
        <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 py-2.5 flex items-center justify-between text-xs z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
              <span className="w-5 h-5 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">D2</span>
              <span>DEBOOGER<span className="text-emerald-500 font-bold">2000</span></span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700 font-mono">DB2K-002</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-zinc-400 border-l border-zinc-700/60 pl-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-zinc-300 font-medium">Standalone Engine</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-400">Offline React 19/18 Transpiler & Sandboxed Auditor</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Demo Launchers */}
            <div className="hidden sm:flex items-center gap-1.5 bg-zinc-800/80 p-0.5 rounded-md border border-zinc-700/60">
              <button
                type="button"
                onClick={handleLoadSampleReact}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-zinc-200 hover:text-white hover:bg-zinc-700/60 transition font-medium text-[11px]"
                title="Load a synthetic React 19 + Lucide + Tailwind CRM app to verify compilation, mounting, and scoring"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test React 19</span>
              </button>
              <button
                type="button"
                onClick={handleLoadSampleHtml}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-zinc-200 hover:text-white hover:bg-zinc-700/60 transition font-medium text-[11px]"
                title="Load a synthetic HTML5 metrics site to test HTML semantics and audit scoring"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Test HTML5</span>
              </button>
            </div>

            {/* Direct Deliverable Download Button */}
            <button
              type="button"
              onClick={handleDownloadStandalone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition shadow-sm cursor-pointer"
              title="Download the complete, self-contained DB2K-002.html file (3.58 MB) for 100% offline usage"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="font-semibold">Download DB2K-002.html</span>
            </button>

            {/* Open in full standalone page */}
            <a
              href="/DB2K-002.html"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              title="Open DB2K-002.html in dedicated tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Collapse toggle */}
            <button
              type="button"
              onClick={() => setHeaderCollapsed(true)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              title="Hide top bar for maximum workspace space"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Floating Expand button if header is collapsed */}
      {headerCollapsed && (
        <button
          type="button"
          onClick={() => setHeaderCollapsed(false)}
          className="fixed top-2 right-4 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-700 text-xs shadow-md transition"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>DEBOOGER Controls</span>
        </button>
      )}

      {/* Full-bleed Host Frame for the standalone DB2K-002 engine */}
      <main className="flex-1 w-full h-full relative overflow-hidden bg-zinc-950">
        <iframe
          ref={iframeRef}
          src="/DB2K-002.html"
          title="DEBOOGER2000 Standalone Workspace"
          className="w-full h-full border-0 bg-white"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </main>
    </div>
  );
}
