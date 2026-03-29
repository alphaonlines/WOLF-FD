import React, { useEffect, useState } from "react";
import { Activity, Bot } from "lucide-react";
import type { AuthUser } from "../types";
import WorkAdvertising from "./WorkAdvertising";
import WolfBot from "./WolfBot";

export type AmpSubTab = "social" | "bot";

type AmpWorkspaceProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
  requestedSubTab?: AmpSubTab;
  requestedSubTabToken?: number;
  onOpenSocialIntegrations: () => void;
};

const AmpWorkspace: React.FC<AmpWorkspaceProps> = ({
  authUser,
  isDarkMode,
  requestedSubTab = "social",
  requestedSubTabToken,
  onOpenSocialIntegrations,
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
      <div className={`flex items-center gap-2 px-6 py-3 ${divider} ${stickyBarClass} flex-wrap`}>
        <button className={tabBtn(subTab === "social")} onClick={() => setSubTab("social")}>
          <Activity size={15} /> Social Posts
        </button>
        <button className={tabBtn(subTab === "bot")} onClick={() => setSubTab("bot")}>
          <Bot size={15} /> AI Bot
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {subTab === "social" ? (
          <WorkAdvertising authUser={authUser} onOpenSocialIntegrations={onOpenSocialIntegrations} />
        ) : (
          <div className="h-full overflow-auto p-5 lg:p-7">
            <WolfBot />
          </div>
        )}
      </div>
    </div>
  );
};

export default AmpWorkspace;
