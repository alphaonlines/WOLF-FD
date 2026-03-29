export const APP_THEME_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
  :root {
    --wolf-card: rgba(255, 255, 255, 0.985);
    --wolf-border: rgba(71, 85, 105, 0.28);
    --wolf-shadow: 0 20px 44px rgba(15, 23, 42, 0.12);
    --wolf-card-muted: rgba(231, 238, 248, 0.99);
    --wolf-text-primary: #0f172a;
    --wolf-text-secondary: #1e293b;
    --wolf-text-muted: #334155;
  }
  .dark {
    color-scheme: dark;
  }
  .dark {
    --wolf-card: rgba(12, 18, 28, 0.88);
    --wolf-card-muted: rgba(16, 24, 36, 0.9);
    --wolf-border: rgba(66, 80, 103, 0.34);
    --wolf-shadow: 0 16px 34px rgba(2, 6, 23, 0.18);
    --wolf-text-primary: #f4f7fb;
    --wolf-text-secondary: #cbd5e1;
    --wolf-text-muted: #94a3b8;
  }
  html, body, #root {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  body {
    font-family: 'Space Grotesk', system-ui, sans-serif;
  }
  .wolf-theme h1,
  .wolf-theme h2,
  .wolf-theme h3 {
    font-family: 'Fraunces', 'Space Grotesk', serif;
    letter-spacing: -0.02em;
  }
  .wolf-theme .bg-white {
    background-color: var(--wolf-card) !important;
    border-color: var(--wolf-border) !important;
    backdrop-filter: blur(14px) saturate(120%);
  }
  .wolf-theme .bg-slate-50 {
    background-color: var(--wolf-card-muted) !important;
  }
  .wolf-theme .bg-white\\/70 {
    background-color: rgba(255, 255, 255, 0.97) !important;
    border-color: rgba(100, 116, 139, 0.32) !important;
    backdrop-filter: blur(12px) saturate(120%);
  }
  .wolf-theme .bg-slate-50\\/90 {
    background-color: rgba(231, 238, 248, 0.97) !important;
  }
  .wolf-theme .bg-slate-100 {
    background-color: rgba(222, 231, 243, 0.98) !important;
  }
  .wolf-theme .bg-slate-200 {
    background-color: rgba(206, 217, 231, 0.98) !important;
  }
  .wolf-theme .shadow-sm {
    box-shadow: var(--wolf-shadow) !important;
  }
  .wolf-theme .rounded-3xl { border-radius: 1.4rem; }
  .wolf-theme .text-slate-900 { color: var(--wolf-text-primary) !important; }
  .wolf-theme .text-slate-800 { color: var(--wolf-text-primary) !important; }
  .wolf-theme .text-slate-700 { color: var(--wolf-text-secondary) !important; }
  .wolf-theme .text-slate-600 { color: var(--wolf-text-secondary) !important; }
  .wolf-theme .text-slate-500 { color: var(--wolf-text-muted) !important; }
  .wolf-theme .text-slate-400 { color: #475569 !important; }
  .wolf-theme .border-slate-200,
  .wolf-theme .border-slate-200\\/60,
  .wolf-theme .border-slate-200\\/80 {
    border-color: rgba(100, 116, 139, 0.34) !important;
  }
  .wolf-theme .border-slate-100 {
    border-color: rgba(148, 163, 184, 0.24) !important;
  }
  .dark .text-slate-800 { color: #dbe6f3 !important; }
  .dark .text-slate-900 { color: var(--wolf-text-primary) !important; }
  .dark .text-slate-950 { color: #f8fbff !important; }
  .dark .text-slate-700 { color: var(--wolf-text-secondary) !important; }
  .dark .text-slate-600 { color: var(--wolf-text-secondary) !important; }
  .dark .text-slate-500 { color: var(--wolf-text-muted) !important; }
  .dark .text-slate-400 { color: #a5b4c7 !important; }
  .dark .bg-slate-50 { background-color: rgba(16, 24, 36, 0.9) !important; }
  .dark .bg-slate-100 { background-color: rgba(18, 27, 40, 0.92) !important; }
  .dark .bg-slate-800 { background-color: rgba(16, 23, 34, 0.92) !important; }
  .dark .bg-slate-900 { background-color: rgba(13, 20, 30, 0.95) !important; }
  .dark .bg-slate-950 { background-color: rgba(10, 15, 23, 0.98) !important; }
  .dark .border-slate-100 { border-color: rgba(57, 69, 88, 0.48) !important; }
  .dark .border-slate-200 { border-color: rgba(64, 77, 98, 0.5) !important; }
  .dark .border-slate-700 { border-color: rgba(68, 82, 104, 0.62) !important; }
  .fd-print-only { display: none; }
  @media print {
    @page { size: landscape; margin: 0.35in; }
    body * { visibility: hidden; }
    body { background: #ffffff !important; }
    #root,
    #root * { visibility: hidden !important; }
    .fd-print-area {
      position: absolute !important;
      inset: 0 auto auto 0 !important;
      width: 100%;
      margin: 0 !important;
      padding: 0 12px !important;
      background: #ffffff !important;
      visibility: visible !important;
    }
    .fd-print-area > * { display: none !important; }
    .fd-print-card {
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 0 0 12px 0;
      padding: 12px !important;
      box-shadow: none !important;
      border: 1px solid #e2e8f0 !important;
      background: #ffffff !important;
    }
    .fd-print-hide { display: none !important; }
    .fd-print-toggle { display: none !important; }
    .fd-print-only,
    .fd-print-only * {
      visibility: visible !important;
    }
    .fd-print-only { display: block !important; }
    .fd-print-area .grid { display: block !important; }
    .fd-print-area .grid > * { width: 100% !important; margin-bottom: 12px; }
    .fd-print-area table,
    .fd-print-area .recharts-wrapper { page-break-inside: avoid; }
    .fd-print-area thead { display: table-header-group; }
    .fd-print-area tr { break-inside: avoid; page-break-inside: avoid; }
    .fd-print-block { break-inside: avoid; page-break-inside: avoid; }
    .fd-print-block table { break-inside: avoid; page-break-inside: avoid; }
    .fd-print-header {
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0f172a;
    }
    .fd-print-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .fd-print-meta {
      font-size: 12px;
      color: #334155;
      margin-top: 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
    }
    .fd-print-area a { color: #0f172a !important; text-decoration: none; }
    .fd-print-area .shadow-sm { box-shadow: none !important; }
    .fd-print-detailed-table th,
    .fd-print-detailed-table td {
      padding: 6px 8px !important;
      white-space: nowrap !important;
      vertical-align: top !important;
    }
  }
  @keyframes overlayDarken {
    0% { background-color: rgba(2, 6, 23, 0.15); }
    100% { background-color: rgba(2, 6, 23, 0.55); }
  }
`;
