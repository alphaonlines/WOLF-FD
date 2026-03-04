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
};

type SalespersonDetailCardProps = {
  selectedSalesperson: string;
  salespersonTickets: SalespersonTicketRow[];
  saleLink: (saleId: string) => string;
  saleLabel: (saleId: string, salesperson?: string) => string;
};

const SalespersonDetailCard: React.FC<SalespersonDetailCardProps> = ({
  selectedSalesperson,
  salespersonTickets,
  saleLink,
  saleLabel,
}) => {
  return (
    <div
      className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
      data-print-id="salesperson-detail"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Salesperson Detail: {selectedSalesperson}</h3>
          <p className="text-sm text-slate-500">All tickets for the selected date range</p>
        </div>
      </div>
      {salespersonTickets.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sale ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.location || "(unknown)"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${row.grandTotal.toLocaleString()}</td>
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
        <p className="text-sm text-slate-500">No tickets found for this salesperson and range.</p>
      )}
    </div>
  );
};

export default SalespersonDetailCard;
