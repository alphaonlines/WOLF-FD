import React from "react";
import { CalendarClock, PhoneCall, Users } from "lucide-react";

type MeetingRoomProps = {
  isDarkMode: boolean;
};

const MeetingRoom: React.FC<MeetingRoomProps> = ({ isDarkMode }) => {
  const panelClass = isDarkMode
    ? "border-slate-800 bg-slate-950 text-slate-100"
    : "border-slate-200 bg-white text-slate-900";
  const mutedClass = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className="h-full overflow-auto px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <section className={`rounded-[28px] border p-5 shadow-sm ${panelClass}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${mutedClass}`}>
                Den
              </div>
              <h2 className="mt-1 text-2xl font-semibold">Meeting Room</h2>
              <p className={`mt-2 max-w-2xl text-sm ${mutedClass}`}>
                This is the new home for stat-meeting workflow inside Den. It’s separated from Message Board now so
                meeting actions and meeting notes can live in their own space.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                isDarkMode
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <PhoneCall size={14} />
              Meeting space ready
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={`rounded-[28px] border p-5 shadow-sm ${panelClass}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl p-2 ${isDarkMode ? "bg-slate-900" : "bg-slate-100"}`}>
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Stat Meeting</h3>
                <p className={`text-sm ${mutedClass}`}>
                  Use this page as the dedicated landing spot for the team’s daily stat meeting flow.
                </p>
              </div>
            </div>
            <div
              className={`mt-4 rounded-2xl border px-4 py-4 text-sm ${
                isDarkMode
                  ? "border-slate-800 bg-slate-900/80 text-slate-300"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              The meeting launcher lived inside Message Board before. It has been moved here so meeting activity no
              longer competes with general team communication.
            </div>
          </section>

          <section className={`rounded-[28px] border p-5 shadow-sm ${panelClass}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl p-2 ${isDarkMode ? "bg-slate-900" : "bg-slate-100"}`}>
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Next Step</h3>
                <p className={`text-sm ${mutedClass}`}>
                  This page is ready to become the dedicated meeting workflow when you want to build it out further.
                </p>
              </div>
            </div>
            <ul className={`mt-4 space-y-2 text-sm ${mutedClass}`}>
              <li>Start a meeting session from here instead of Message Board.</li>
              <li>Keep meeting notes, attendance, and follow-ups separate from normal messages.</li>
              <li>Add meeting templates or scorecards later without crowding the board UI.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;
