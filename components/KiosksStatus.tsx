import React from "react";
import { Plus, Wifi, WifiOff } from "lucide-react";

const onlineKiosks = [
  "FD5",
  "FD7",
  "G1",
  "Base",
  "Camp",
  "FD51(mini)",
  "FDUser(mini)",
  "FD71(mini)",
];

const offlineKiosks = [
  "G11(mini)",
  "FD10(mini)",
  "FD52",
  "FD7E(mini)",
  "FD7B(mini)",
  "FD7A(mini)",
];

const desktopsOnline = ["FD7"];
const tabletsOnline = ["FD7T", "FD7T1"];

type KioskRow = {
  location: string;
  status: "Online" | "Offline";
};

const toRows = (items: string[], status: KioskRow["status"]): KioskRow[] =>
  items.map((location) => ({ location, status }));

const kiosks = [...toRows(onlineKiosks, "Online"), ...toRows(offlineKiosks, "Offline")];

const getTypeLabel = (location: string) => {
  const match = location.trim().match(/[a-z]$/i);
  if (match) {
    const letter = match[0].toUpperCase();
    if (letter === "A") return "Archbold";
    if (letter === "B") return "Best";
    if (letter === "E") return "England";
  }
  return location.toLowerCase().includes("(mini)") ? "Mini" : "Standard";
};

const KiosksStatus: React.FC = () => {
  const onlineCount = onlineKiosks.length;
  const offlineCount = offlineKiosks.length;
  const desktopCount = desktopsOnline.length;
  const tabletCount = tabletsOnline.length;

  return (
    <div className="space-y-6">
      <section className="bg-amber-50 border border-amber-200 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Coming Soon</div>
          <h2 className="text-2xl font-semibold text-amber-950">AlphaOS dashboard is coming soon.</h2>
          <p className="text-sm text-amber-900/80">
            This page is currently a placeholder while the real AlphaOS experience is being built.
          </p>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Kiosks Status</h2>
            <p className="text-sm text-slate-500">Unlimited license available for all locations.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800"
            title="Add kiosk"
            onClick={() => {}}
          >
            <Plus size={16} />
            Add Kiosk
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total Kiosks</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{kiosks.length}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Online</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900">{onlineCount}</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <div className="text-xs uppercase tracking-wide text-rose-700">Offline</div>
            <div className="mt-2 text-2xl font-semibold text-rose-900">{offlineCount}</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-xs uppercase tracking-wide text-blue-700">Desktops/Tablet</div>
            <div className="mt-2 text-2xl font-semibold text-blue-900">{desktopCount + tabletCount}</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Desktops</h3>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Online</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="py-3 pr-6">Device</th>
                <th className="py-3 pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {desktopsOnline.map((device) => (
                <tr key={`desktop-${device}`}>
                  <td className="py-3 pr-6 font-semibold text-slate-900">{device}</td>
                  <td className="py-3 pr-6">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Wifi size={12} />
                      Online
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Tablets</h3>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Online</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="py-3 pr-6">Device</th>
                <th className="py-3 pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tabletsOnline.map((device) => (
                <tr key={`tablet-${device}`}>
                  <td className="py-3 pr-6 font-semibold text-slate-900">{device}</td>
                  <td className="py-3 pr-6">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Wifi size={12} />
                      Online
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Locations</h3>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">License: Unlimited</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="py-3 pr-6">Location</th>
                <th className="py-3 pr-6">Type</th>
                <th className="py-3 pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kiosks.map((kiosk) => (
                <tr key={kiosk.location}>
                  <td className="py-3 pr-6 font-semibold text-slate-900">{kiosk.location}</td>
                  <td className="py-3 pr-6 text-slate-600">{getTypeLabel(kiosk.location)}</td>
                  <td className="py-3 pr-6">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${
                        kiosk.status === "Online"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {kiosk.status === "Online" ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {kiosk.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default KiosksStatus;
