import React from "react";
import { formatShortDate } from "../salesUtils";

export type SalespersonTicketRow = {
  saleId: string;
  saleDate: string;
  salesperson: string;
  location: string;
  receiptNo: string;
  customerName: string;
  grandTotal: number;
  profit: number;
  marginPct: number | null;
  pro1stSales: number;
  pro1stPct: number | null;
};

type SalespersonDetailCardProps = {
  selectedSalesperson?: string;
  selectedStore?: string;
  selectedDay?: string;
  salespersonTickets: SalespersonTicketRow[];
  saleLink: (saleId: string) => string;
  saleLabel: (saleId: string, salesperson?: string) => string;
};

const SalespersonDetailCard: React.FC<SalespersonDetailCardProps> = ({
  selectedSalesperson,
  selectedStore,
  selectedDay,
  salespersonTickets,
  saleLink,
  saleLabel,
}) => {
  const isDayDetail = !!selectedDay;
  const isStoreDetail = !!selectedStore;
  const title = isDayDetail
    ? `Day Detail: ${formatShortDate(selectedDay || "")}`
    : isStoreDetail
      ? `Store Detail: ${selectedStore}`
      : `Salesperson Detail: ${selectedSalesperson || ""}`;
  const subtitle = isDayDetail
    ? "All tickets for the clicked trend day"
    : "All tickets for the selected date range";
  const emptyMessage = isDayDetail
    ? "No tickets found for this day."
    : isStoreDetail
      ? "No tickets found for this store and range."
      : "No tickets found for this salesperson and range.";

  return (
    <div
      className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
      data-print-id="salesperson-detail"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {salespersonTickets.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sale ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                {(isStoreDetail || isDayDetail) && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Salesperson</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pro1st</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pro1st %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Profit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Margin %</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {salespersonTickets.map((row, idx) => (
                <tr key={`${row.saleId}-${idx}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                    <a href={saleLink(row.saleId)} target="_blank" rel="noopener noreferrer">
                      {saleLabel(row.saleId, row.salesperson)}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {formatShortDate(String(row.saleDate || ""))}
                  </td>
                  {(isStoreDetail || isDayDetail) && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.salesperson || "(unknown)"}</td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.location || "(unknown)"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${row.grandTotal.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${row.pro1stSales.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {row.pro1stPct !== null ? `${row.pro1stPct.toFixed(1)}%` : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${row.profit.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {row.marginPct !== null ? `${row.marginPct.toFixed(1)}%` : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
};

export default SalespersonDetailCard;
