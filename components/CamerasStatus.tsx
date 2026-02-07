import React from "react";
import { Plus, Wifi, WifiOff, Video } from "lucide-react";

const nightOwlProtectOnline = ["G1", "FD5", "FD7", "CCRE"];
const nightOwlProtectOffline = ["LIQdators", "FD51"];
const nightOwlConnectOnline = ["BW"];

const makeRows = (items: string[], status: "Online" | "Offline") =>
  items.map((location) => ({ location, status }));

type CameraRow = {
  location: string;
  status: "Online" | "Offline";
  cameras: number;
};

const cameraCounts: Record<string, number> = {
  FD5: 12,
  FD51: 5,
  LIQdators: 4,
};

const withCounts = (rows: { location: string; status: "Online" | "Offline" }[]): CameraRow[] =>
  rows.map((row) => ({
    ...row,
    cameras: cameraCounts[row.location] ?? 6,
  }));

const protectRows: CameraRow[] = withCounts([
  ...makeRows(nightOwlProtectOnline, "Online"),
  ...makeRows(nightOwlProtectOffline, "Offline"),
]);

const connectRows: CameraRow[] = withCounts([
  ...makeRows(nightOwlConnectOnline, "Online"),
]);

const CamerasStatus: React.FC = () => {
  const protectOnline = nightOwlProtectOnline.length;
  const protectOffline = nightOwlProtectOffline.length;
  const connectOnline = nightOwlConnectOnline.length;

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Cameras Status</h2>
            <p className="text-sm text-slate-500">Night Owl Protect and Night Owl Connect coverage by location.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://nightowlsp.com/account/login?srsltid=AfmBOoq-rBlCD1SVI2YhgIlAFDkfasVdCKbCCkjJZQc5KWt9_ptAE01d"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
              title="Night Owl login"
            >
              <Video size={16} />
              Night Owl Login
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800"
              title="Add camera"
              onClick={() => {}}
            >
              <Plus size={16} />
              Add Camera
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Protect Online</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{protectOnline}</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <div className="text-xs uppercase tracking-wide text-rose-700">Protect Offline</div>
            <div className="mt-2 text-2xl font-semibold text-rose-900">{protectOffline}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Connect Online</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900">{connectOnline}</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Night Owl Protect</h3>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locations</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="py-3 pr-6">Location</th>
                <th className="py-3 pr-6">Status</th>
                <th className="py-3 pr-6">Cameras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {protectRows.map((row) => (
                <tr key={`protect-${row.location}`}>
                  <td className="py-3 pr-6 font-semibold text-slate-900">{row.location}</td>
                  <td className="py-3 pr-6">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${
                        row.status === "Online"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {row.status === "Online" ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-slate-700">{row.cameras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Night Owl Connect</h3>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locations</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="py-3 pr-6">Location</th>
                <th className="py-3 pr-6">Status</th>
                <th className="py-3 pr-6">Cameras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {connectRows.map((row) => (
                <tr key={`connect-${row.location}`}>
                  <td className="py-3 pr-6 font-semibold text-slate-900">{row.location}</td>
                  <td className="py-3 pr-6">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Wifi size={12} />
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-slate-700">{row.cameras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default CamerasStatus;
