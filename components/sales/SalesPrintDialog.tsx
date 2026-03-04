import React from "react";

type SalesPrintDialogProps = {
  open: boolean;
  printIncludeLowMargin: boolean;
  printIncludeStore: boolean;
  printIncludeSalesperson: boolean;
  printIncludeManufacturer: boolean;
  printIncludeCategory: boolean;
  printLoading: boolean;
  setPrintIncludeLowMargin: (value: boolean) => void;
  setPrintIncludeStore: (value: boolean) => void;
  setPrintIncludeSalesperson: (value: boolean) => void;
  setPrintIncludeManufacturer: (value: boolean) => void;
  setPrintIncludeCategory: (value: boolean) => void;
  onClose: () => void;
  onPrint: () => void;
};

const SalesPrintDialog: React.FC<SalesPrintDialogProps> = ({
  open,
  printIncludeLowMargin,
  printIncludeStore,
  printIncludeSalesperson,
  printIncludeManufacturer,
  printIncludeCategory,
  printLoading,
  setPrintIncludeLowMargin,
  setPrintIncludeStore,
  setPrintIncludeSalesperson,
  setPrintIncludeManufacturer,
  setPrintIncludeCategory,
  onClose,
  onPrint,
}) => {
  if (!open) return null;

  return (
    <div className="fd-print-hide fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Print Options</h3>
            <p className="text-sm text-slate-500">Choose which reports to include and apply optional filters.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Reports</div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={printIncludeLowMargin}
                onChange={(e) => setPrintIncludeLowMargin(e.target.checked)}
              />
              Lowest Margin Tickets
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={printIncludeStore}
                onChange={(e) => setPrintIncludeStore(e.target.checked)}
              />
              Totals by Store
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={printIncludeSalesperson}
                onChange={(e) => setPrintIncludeSalesperson(e.target.checked)}
              />
              Totals by Salesperson
            </label>
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Additional Reports (Print)</div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={printIncludeManufacturer}
                onChange={(e) => setPrintIncludeManufacturer(e.target.checked)}
              />
              Drill down by Manufacturer (all)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={printIncludeCategory}
                onChange={(e) => setPrintIncludeCategory(e.target.checked)}
              />
              Drill down by Category (all)
            </label>
            <div className="text-xs text-slate-500">These add extra sections and may produce many pages.</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={printLoading}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {printLoading ? "Preparing..." : "Print"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesPrintDialog;
