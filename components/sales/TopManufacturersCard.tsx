import React from "react";

export type TopManufacturerRow = {
  manufacturer: string;
  qty: number;
  sales: number;
};

export type ManufacturerItemRow = {
  itemDescription: string;
  category: string;
  itemNo: string;
  qty: number;
  sales: number;
  saleIds: string[];
};

type TopManufacturersCardProps = {
  collapsed: boolean;
  renderHelp: (text: string) => React.ReactNode;
  cardToggle: React.ReactNode;
  itemSortMetric: "sales" | "qty";
  topManufacturers: TopManufacturerRow[];
  compareManufacturers?: TopManufacturerRow[];
  renderMetricComparison?: (current: number, previous: number) => React.ReactNode;
  expandedManufacturers: Record<string, boolean>;
  manufacturerItems: Record<string, ManufacturerItemRow[]>;
  manufacturerLoading: Record<string, boolean>;
  onToggleManufacturer: (manufacturer: string) => void;
  limitSaleLinks: (ids: string[], max?: number) => { ids: string[]; remaining: number };
  saleLink: (saleId: string) => string;
  saleLabel: (saleId: string) => string;
};

const TopManufacturersCard: React.FC<TopManufacturersCardProps> = ({
  collapsed,
  renderHelp,
  cardToggle,
  itemSortMetric,
  topManufacturers,
  compareManufacturers = [],
  renderMetricComparison,
  expandedManufacturers,
  manufacturerItems,
  manufacturerLoading,
  onToggleManufacturer,
  limitSaleLinks,
  saleLink,
  saleLabel,
}) => {
  const primaryLabel = itemSortMetric === "qty" ? "units" : "sales";
  const compareByManufacturer = React.useMemo(
    () => new Map(compareManufacturers.map((row) => [row.manufacturer, row])),
    [compareManufacturers]
  );
  const maxValue = Math.max(
    1,
    ...topManufacturers.map((row) => Math.max(0, itemSortMetric === "qty" ? Number(row.qty || 0) : Number(row.sales || 0)))
  );

  return (
    <div
      className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
      data-print-id="top-manufacturers"
      data-testid="top-manufacturers-card"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Top Manufacturers
            <span className={`text-xs font-normal ${collapsed ? "text-slate-400" : "hidden"}`}>
              (collapsed — click to expand)
            </span>
            {renderHelp("Based on item report: manufacturer totals for qty and sales in the selected range.")}
          </h3>
          <p className="text-sm text-slate-500">
            Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"}. Click a bar to drill down into top items.
          </p>
        </div>
        {cardToggle}
      </div>
      {!collapsed &&
        (topManufacturers.length ? (
          <div className="space-y-4">
            {topManufacturers.map((row) => {
              const manufacturer = row.manufacturer || "Unknown manufacturer";
              const isOpen = !!expandedManufacturers[row.manufacturer];
              const items = manufacturerItems[row.manufacturer] || [];
              const loading = manufacturerLoading[row.manufacturer];
              const primaryValue = itemSortMetric === "qty" ? Number(row.qty || 0) : Number(row.sales || 0);
              const compareRow = compareByManufacturer.get(row.manufacturer);
              const comparePrimaryValue = itemSortMetric === "qty" ? Number(compareRow?.qty || 0) : Number(compareRow?.sales || 0);
              const pct = Math.round((primaryValue / maxValue) * 100);
              const barWidth = `${Math.max(5, Math.min(100, pct))}%`;

              return (
                <div
                  key={row.manufacturer}
                  className={`border rounded-lg transition-colors ${isOpen ? "border-blue-200 bg-blue-50/60" : "border-slate-100"}`}
                >
                  <button
                    type="button"
                    aria-label={`Drill down into ${manufacturer}`}
                    onClick={() => onToggleManufacturer(row.manufacturer)}
                    className={`w-full px-4 py-3 text-left ${isOpen ? "hover:bg-blue-50" : "hover:bg-slate-50"}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{manufacturer}</div>
                        <div className="text-xs text-slate-500">{row.qty.toLocaleString()} qty</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-800">${row.sales.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">{pct}% of top {primaryLabel}</div>
                        {renderMetricComparison?.(primaryValue, comparePrimaryValue)}
                      </div>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        role="progressbar"
                        aria-label={`${manufacturer} ${primaryLabel} share`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
                        style={{ width: barWidth }}
                      />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {loading ? (
                        <div className="text-xs text-slate-500">Loading top items…</div>
                      ) : items.length ? (
                        <div className="space-y-3">
                          {items.map((item) => {
                            const { ids, remaining } = limitSaleLinks(item.saleIds);
                            return (
                              <div key={`${row.manufacturer}-${item.itemNo}-${item.itemDescription}`} className="flex flex-col gap-1">
                                <div className="flex items-start justify-between gap-4 text-sm">
                                  <div>
                                    <div className="font-semibold text-slate-800">{item.itemDescription || "Unnamed Item"}</div>
                                    <div className="text-xs text-slate-500">{(item.category || "Uncategorized").toUpperCase()}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-slate-800">{item.qty.toLocaleString()} qty</div>
                                    <div className="text-xs text-slate-500">${item.sales.toLocaleString()}</div>
                                  </div>
                                </div>
                                {ids.length > 0 && (
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {ids.map((sid) => (
                                      <a
                                        key={sid}
                                        href={saleLink(sid)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      >
                                        {saleLabel(sid)}
                                      </a>
                                    ))}
                                    {remaining > 0 && (
                                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500">+{remaining} more</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No items for this brand.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No manufacturer data available for this range.</p>
        ))}
    </div>
  );
};

export default TopManufacturersCard;
