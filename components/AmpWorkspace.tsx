import React, { useEffect, useState } from "react";
import { Activity, Bot, Gamepad2 } from "lucide-react";
import type { AuthUser } from "../types";
import { useBotBotContext } from "./botbot/BotBotContext";
import WorkAdvertising from "./WorkAdvertising";
import WolfBot from "./WolfBot";

export type AmpSubTab = "social" | "bot" | "tycoon";

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
  requestedSubTab = "social",
  requestedSubTabToken,
  onOpenSocialIntegrations,
  hideTabBar = false,
}) => {
  const [subTab, setSubTab] = useState<AmpSubTab>(requestedSubTab);
  const { setPageContext } = useBotBotContext();

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  useEffect(() => {
    setPageContext({
      pageName: "AI Bot",
      module: "amp.bot",
      userRole: "Employee",
      keyMetricsVisible: [],
      suggestedActions: [],
    });
  }, [setPageContext]);

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
        <button className={tabBtn(subTab === "social")} onClick={() => setSubTab("social")}>
          <Activity size={15} /> Social Posts
        </button>
        <button className={tabBtn(subTab === "bot")} onClick={() => setSubTab("bot")}>
          <Bot size={15} /> AI Bot
        </button>
        <button className={tabBtn(subTab === "tycoon")} onClick={() => setSubTab("tycoon")}>
          <Gamepad2 size={15} /> Tycoon
        </button>
      </div>
      )}

      <div className="flex-1 overflow-hidden">
        {subTab === "social" ? (
          <WorkAdvertising authUser={authUser} onOpenSocialIntegrations={onOpenSocialIntegrations} />
        ) : subTab === "bot" ? (
          <div className="h-full overflow-auto p-5 lg:p-7">
            <WolfBot />
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
