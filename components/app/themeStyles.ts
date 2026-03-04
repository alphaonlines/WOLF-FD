export const APP_THEME_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
  :root {
    --wolf-card: rgba(255, 255, 255, 0.78);
    --wolf-border: rgba(148, 163, 184, 0.22);
    --wolf-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  }
  .dark {
    color-scheme: dark;
  }
  .dark {
    --wolf-card: rgba(15, 23, 42, 0.72);
    --wolf-border: rgba(71, 85, 105, 0.55);
    --wolf-shadow: 0 16px 36px rgba(2, 6, 23, 0.45);
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
    backdrop-filter: blur(10px) saturate(120%);
  }
  .wolf-theme .shadow-sm {
    box-shadow: var(--wolf-shadow) !important;
  }
  .wolf-theme .rounded-3xl { border-radius: 1.4rem; }
  .dark .text-slate-800 { color: #e2e8f0 !important; }
  .dark .text-slate-900 { color: #f1f5f9 !important; }
  .dark .text-slate-950 { color: #f8fafc !important; }
  .dark .text-slate-700 { color: #cbd5f1 !important; }
  .dark .text-slate-600 { color: #cbd5f1 !important; }
  .dark .text-slate-500 { color: #94a3b8 !important; }
  .dark .text-slate-400 { color: #94a3b8 !important; }
  .dark .bg-slate-50 { background-color: rgba(15, 23, 42, 0.9) !important; }
  .dark .bg-slate-100 { background-color: rgba(30, 41, 59, 0.8) !important; }
  .dark .border-slate-100 { border-color: rgba(51, 65, 85, 0.8) !important; }
  .dark .border-slate-200 { border-color: rgba(51, 65, 85, 0.8) !important; }
  .fd-print-only { display: none; }
  @media print {
    body * { visibility: hidden; }
    body { background: #ffffff !important; }
    .fd-print-area,
    .fd-print-area * { visibility: visible; }
    .fd-print-area {
      position: static;
      width: 100%;
      padding: 0 12px !important;
      background: #ffffff !important;
    }
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
  }
  @keyframes overlayDarken {
    0% { background-color: rgba(2, 6, 23, 0.15); }
    100% { background-color: rgba(2, 6, 23, 0.55); }
  }
`;
