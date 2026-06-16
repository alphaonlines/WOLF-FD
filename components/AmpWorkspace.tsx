import React, { useEffect, useState } from "react";
import { Activity, Bot, Gamepad2, Monitor, Star } from "lucide-react";
import type { AuthUser } from "../types";
import WorkAdvertising from "./WorkAdvertising";
import KiosksStatus from "./KiosksStatus";

export type AmpSubTab = "social" | "bot" | "tycoon" | "kiosks" | "fdconnect";

const FD_CONNECT_URL = "https://www.furnituredistributors.net/content/connect";

type AmpWorkspaceProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
  requestedSubTab?: AmpSubTab;
  requestedSubTabToken?: number;
  onOpenSocialIntegrations: () => void;
  hideTabBar?: boolean;
};

const AmpWorkspace: React.FC<AmpWorkspaceProps> = ({
  authUser,
  isDarkMode,
  requestedSubTab = "bot",
  requestedSubTabToken,
  onOpenSocialIntegrations,
  hideTabBar = false,
}) => {
  const [subTab, setSubTab] = useState<AmpSubTab>(requestedSubTab);

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  const divider = isDarkMode ? "border-slate-800" : "border-slate-200";
  const stickyBarClass = isDarkMode
    ? "sticky top-20 z-20 border-b border-slate-800 bg-[#121b27]/94 backdrop-blur-xl"
    : "sticky top-20 z-20 border-b border-slate-200 bg-white/92 backdrop-blur-xl";

  const tabBtn = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
      active
        ? isDarkMode
          ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
          : "bg-cyan-50 text-cyan-700 border border-cyan-200"
        : isDarkMode
          ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar - hidden when shown in header */}
      {!hideTabBar && (
      <div className={`flex items-center gap-2 px-6 py-3 ${divider} ${stickyBarClass} flex-wrap`}>
        <button className={tabBtn(subTab === "bot")} onClick={() => setSubTab("bot")}>
          <Bot size={15} /> AI Bot
        </button>
        <button data-tour-id="amp-tab-social" className={tabBtn(subTab === "social")} onClick={() => setSubTab("social")}>
          <Activity size={15} /> Social
        </button>
        <button className={tabBtn(subTab === "tycoon")} onClick={() => setSubTab("tycoon")}>
          <Gamepad2 size={15} /> Tycoon
        </button>
        <button className={tabBtn(subTab === "kiosks")} onClick={() => setSubTab("kiosks")}>
          <Monitor size={15} /> Kiosks
        </button>
        <button className={tabBtn(subTab === "fdconnect")} onClick={() => setSubTab("fdconnect")}>
          <Star size={15} /> FD Connect
        </button>
      </div>
      )}

      <div className="flex-1 overflow-hidden">
        {subTab === "social" ? (
          <WorkAdvertising authUser={authUser} onOpenSocialIntegrations={onOpenSocialIntegrations} />
        ) : subTab === "bot" ? (
          <div className="h-[calc(100dvh-8rem)] min-h-[720px] w-full overflow-hidden bg-white" data-amp-ai-embed="wolf-discount-ai-fullbleed-visible">
            <iframe
              title="WOLF AI workspace"
              src="https://wolf.discount/ai/"
              className="block h-full w-full border-0 bg-white"
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-write; microphone; camera; fullscreen"
            />
          </div>
        ) : subTab === "kiosks" ? (
          <KiosksStatus />
        ) : subTab === "fdconnect" ? (
          <div className="h-full w-full overflow-hidden">
            <iframe
              src={FD_CONNECT_URL}
              title="FD Connect"
              className="w-full h-full border-none"
              style={{ height: "100vh" }}
            />
          </div>
        ) : (
          <div className="h-full overflow-auto p-5 lg:p-7">
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200 rounded-2xl p-8 text-center">
                <Gamepad2 className="mx-auto h-16 w-16 text-amber-600 mb-4" />
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Furniture Distributors Tycoon</h2>
                <p className="text-slate-600 mb-6">Play the showroom delivery game!</p>
                <a
                  href="https://furnituredistributors.wolf.discount/tycoon/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition"
                >
                  Play Now
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AmpWorkspace;
