import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SalesPrintContent, { type SalesPrintContentProps } from "./SalesPrintContent";

const printStyles = `
  @page {
    size: landscape;
    margin: 0.35in;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: Inter, Arial, sans-serif;
  }

  body {
    padding: 24px;
  }

  .fd-print-root {
    width: 100%;
  }

  .space-y-6 > * + * {
    margin-top: 24px;
  }

  .space-y-4 > * + * {
    margin-top: 16px;
  }

  .fd-print-header {
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 14px;
  }

  .fd-print-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #0f172a;
  }

  .fd-print-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 6px 16px;
    margin-top: 10px;
    font-size: 12px;
    color: #475569;
  }

  .fd-print-block {
    break-inside: avoid;
    page-break-inside: avoid;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 16px;
    background: #ffffff;
  }

  h3, h4 {
    margin: 0;
    color: #0f172a;
  }

  .text-lg {
    font-size: 18px;
    line-height: 1.35;
  }

  .text-base {
    font-size: 16px;
    line-height: 1.35;
  }

  .text-sm {
    font-size: 12px;
    line-height: 1.45;
  }

  .font-semibold {
    font-weight: 600;
  }

  .mb-3 {
    margin-bottom: 12px;
  }

  .mb-2 {
    margin-bottom: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  thead {
    display: table-header-group;
  }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  thead th {
    background: #f8fafc;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 10px;
    font-weight: 700;
  }

  th, td {
    border-bottom: 1px solid #e2e8f0;
    padding: 6px 8px;
    vertical-align: top;
    word-break: break-word;
    font-size: 11px;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .text-left {
    text-align: left;
  }

  .text-right {
    text-align: right;
  }

  .bg-slate-50 {
    background: #f8fafc;
  }

  .bg-white {
    background: #ffffff;
  }

  .text-slate-900, .text-slate-800, .text-slate-700 {
    color: #0f172a;
  }

  .text-slate-600, .text-slate-500 {
    color: #475569;
  }

  .rounded-xl {
    border-radius: 14px;
  }

  .border {
    border: 1px solid #e2e8f0;
  }

  .border-slate-100, .border-slate-200 {
    border-color: #e2e8f0;
  }

  .p-4 {
    padding: 16px;
  }

  .overflow-x-auto, .overflow-x-visible {
    overflow: visible;
  }

  .fd-print-detailed-table {
    font-variant-numeric: tabular-nums;
  }

  @media print {
    body {
      padding: 0;
    }
  }
`;

export const openSalesPrintWindow = (props: SalesPrintContentProps): boolean => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");
  if (!printWindow) return false;

  const markup = renderToStaticMarkup(<SalesPrintContent {...props} />);
  const title = `WOLF FD Sales Report${props.rangeLabel ? ` - ${props.rangeLabel}` : ""}`;

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>${printStyles}</style>
  </head>
  <body>
    ${markup}
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.focus();
          window.print();
        }, 250);
      });
      window.addEventListener('afterprint', function () {
        setTimeout(function () { window.close(); }, 150);
      });
    </script>
  </body>
</html>`);
  printWindow.document.close();
  return true;
};
