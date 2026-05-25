import React, { useEffect, useState } from "react";
import { CheckSquare, CalendarClock, Compass, Link2, MessageSquare, Mic, UserCheck, Users } from "lucide-react";
import type { AuthUser } from "../types";
import { TaskStatus } from "../types";
import { useBotBotContext } from "./botbot/BotBotContext";
import BotBotTutorial, { BotBotTutorialStep } from "./botbot/BotBotTutorial";
import CRMWorkspace from "./CRMWorkspace";
import MessageBoard from "./MessageBoard";
import TaskManager from "./TaskManager";
import { createTask } from "../services/tasksService";
import MeetingRoom from "./MeetingRoom";
import DenRecorder from "./DenRecorder";
import { DEFAULT_STORE_CODE, normalizeStoreCode, type StoreCode } from "../storeLocations";

type WolfdenWorkspaceProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
  requestedSubTab?: WolfdenSubTab;
  requestedSubTabToken?: number;
  selectedStore?: StoreCode;
  onStoreChange?: (store: string) => void;
  hideTabBar?: boolean;
  tourStorageKey?: string;
  enableTourAutoStart?: boolean;
};

export type WolfdenSubTab = "ups" | "crm" | "board" | "meeting" | "recorder" | "tasks";

const QUICKLINKS_URL = "https://sites.google.com/view/fdserver/home";

const WOLFDEN_TOUR_STEPS: BotBotTutorialStep[] = [
  {
    id: "den-ups",
    highlightId: "den-tab-ups",
    title: "Start with the UPS list",
    message: "This is the daily floor queue. Use it to see who is up, who is waiting, and where the sales floor needs attention.",
    advanceWhen: {
      type: "state",
      check: (state) => state.subTab === "ups",
    },
  },
  {
    id: "den-crm",
    highlightId: "den-tab-crm",
    title: "Open the customer workspace",
    message: "CRM is where DEN turns conversations into customer records, notes, history, and follow-up work.",
    advanceWhen: {
      type: "state",
      check: (state) => state.subTab === "crm",
    },
  },
  {
    id: "den-board",
    highlightId: "den-tab-board",
    title: "Keep the team in sync",
    message: "The board is for quick store communication: updates, handoffs, questions, and messages that should not disappear in a side chat.",
    advanceWhen: {
      type: "state",
      check: (state) => state.subTab === "board",
    },
  },
  {
    id: "den-meeting",
    highlightId: "den-tab-meeting",
    title: "Use the meeting room",
    message: "Meeting Room gives the team a shared place for huddles, decisions, and notes that need to stay attached to the workflow.",
    advanceWhen: {
      type: "state",
      check: (state) => state.subTab === "meeting",
    },
  },
  {
    id: "den-recorder",
    highlightId: "den-tab-recorder",
    title: "Record Den sessions",
    message: "Recorder captures planning rambles, meetings, and webinar audio so the transcript and follow-up can live with DEN.",
    advanceWhen: {
      type: "state",
      check: (state) => state.subTab === "recorder",
    },
  },
  {
    id: "den-tasks",
    highlightId: "den-tab-tasks",
    title: "Track the follow-through",
    message: "Tasks are the accountability lane for DEN. If something needs to happen later, it belongs here instead of living in memory.",
    advanceWhen: {
      type: "state",
      check: (state) => state.subTab === "tasks",
    },
  },
  {
    id: "den-quicklinks",
    highlightId: "den-quicklinks",
    title: "Jump to QuickLinks",
    message: "QuickLinks opens the existing FD resource hub when the team needs forms, references, or store links outside the dashboard.",
    advanceWhen: { type: "manual" },
  },
  {
    id: "den-botbot",
    highlightId: "botbot-entry",
    title: "Ask BotBot inside DEN",
    message: "BotBot follows the page context, so this is the helper to use when someone needs guidance inside a DEN workflow.",
    highlightOnAction: true,
    advanceWhen: { type: "manual" },
    primaryActionLabel: "Done",
    isTerminal: true,
  },
];

const WolfdenWorkspace: React.FC<WolfdenWorkspaceProps> = ({
  authUser,
  isDarkMode,
  requestedSubTab = "ups",
  requestedSubTabToken,
  selectedStore: controlledStore,
  onStoreChange,
  hideTabBar = false,
  tourStorageKey = "fd-tour-den",
  enableTourAutoStart = true,
}) => {
  const [subTab, setSubTab] = useState<WolfdenSubTab>(requestedSubTab);
  const [internalStore, setInternalStore] = useState<StoreCode>(DEFAULT_STORE_CODE);
  const selectedStore = normalizeStoreCode(controlledStore) ?? internalStore;
  const setSelectedStore = onStoreChange ?? ((store: string) => setInternalStore(normalizeStoreCode(store) ?? DEFAULT_STORE_CODE));
  const [showDenTour, setShowDenTour] = useState(false);
  const { setPageContext } = useBotBotContext();

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  useEffect(() => {
    setPageContext({
      pageName: "Wolfden",
      module: "wolfden",
      userRole: "Employee",
      keyMetricsVisible: [],
      suggestedActions: [],
    });
  }, [setPageContext]);

  useEffect(() => {
    if (!enableTourAutoStart) {
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        if (!window.localStorage.getItem(tourStorageKey)) {
          setShowDenTour(true);
        }
      } catch {
        setShowDenTour(true);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [enableTourAutoStart, tourStorageKey]);

  const completeDenTour = () => {
    try {
      window.localStorage.setItem(tourStorageKey, new Date().toISOString());
    } catch {
      // If storage is blocked, still close the tour for this session.
    }
    setShowDenTour(false);
  };

  const divider = isDarkMode ? "border-slate-800" : "border-slate-200";
  const stickyBarClass = isDarkMode
    ? "sticky top-20 z-20 border-b border-slate-800 bg-[#121b27]/94 backdrop-blur-xl"
    : "sticky top-20 z-20 border-b border-slate-200 bg-white/92 backdrop-blur-xl";

  const tabBtn = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
      active
        ? isDarkMode
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "bg-amber-50 text-amber-600 border border-amber-200"
        : isDarkMode
        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
    }`;

  const handleMessageSent = async (info: { author: string; body: string; channel: string | null }) => {
    try {
      const label = info.channel ? `#${info.channel}` : "DM";
      const title = `[${label}] ${info.body.slice(0, 70)}${info.body.length > 70 ? "…" : ""}`;
      await createTask({
        title,
        assignee: info.author,
        deadline: "",
        status: TaskStatus.TODO,
        priority: "low",
      });
    } catch {
      // silently fail — task creation shouldn't block message send
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar - hidden when shown in header */}
      {!hideTabBar && (
      <div className={`flex items-center gap-2 px-6 py-3 ${divider} ${stickyBarClass} flex-wrap`}>
        <button data-tour-id="den-tab-ups" className={tabBtn(subTab === "ups")} onClick={() => setSubTab("ups")}>
          <UserCheck size={15} /> UPS List
        </button>
        <button data-tour-id="den-tab-crm" className={tabBtn(subTab === "crm")} onClick={() => setSubTab("crm")}>
          <Users size={15} /> CRM
        </button>
        <button data-tour-id="den-tab-board" className={tabBtn(subTab === "board")} onClick={() => setSubTab("board")}>
          <MessageSquare size={15} /> Message Board
        </button>
        <button data-tour-id="den-tab-meeting" className={tabBtn(subTab === "meeting")} onClick={() => setSubTab("meeting")}>
          <CalendarClock size={15} /> Meeting Room
        </button>
        <button data-tour-id="den-tab-recorder" className={tabBtn(subTab === "recorder")} onClick={() => setSubTab("recorder")}>
          <Mic size={15} /> Recorder
        </button>
        <button data-tour-id="den-tab-tasks" className={tabBtn(subTab === "tasks")} onClick={() => setSubTab("tasks")}>
          <CheckSquare size={15} /> Tasks
        </button>
        <a
          data-tour-id="den-quicklinks"
          href={QUICKLINKS_URL}
          target="_blank"
          rel="noreferrer"
          className={tabBtn(false)}
          title="Open QuickLinks"
        >
          <Link2 size={15} />
          <span>QuickLinks</span>
        </a>
      </div>
      )}

      <div className={`flex items-center justify-end border-b px-5 py-2 ${isDarkMode ? "border-slate-800 bg-[#121b27]" : "border-slate-100 bg-white"}`}>
        <button
          type="button"
          data-tour-id="den-module-tour"
          onClick={() => setShowDenTour(true)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            isDarkMode
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          <Compass size={14} />
          Tour
        </button>
      </div>

      {/* Content */}
      <div data-tour-id="den-workspace-content" className="flex-1 overflow-hidden">
        {subTab === "ups" && <CRMWorkspace authUser={authUser} isDarkMode={isDarkMode} view="queue" selectedStore={selectedStore} onStoreChange={setSelectedStore} />}
        {subTab === "crm" && <CRMWorkspace authUser={authUser} isDarkMode={isDarkMode} view="customers" selectedStore={selectedStore} onStoreChange={setSelectedStore} />}
        {subTab === "board" && <MessageBoard authUser={authUser} onMessageSent={handleMessageSent} />}
        {subTab === "meeting" && <MeetingRoom isDarkMode={isDarkMode} authUser={authUser} />}
        {subTab === "recorder" && <DenRecorder isDarkMode={isDarkMode} authUser={authUser} />}
        {subTab === "tasks" && (
          <div className="h-full overflow-auto px-5 py-5 lg:px-7 lg:py-7">
            <TaskManager selectedStore={selectedStore} />
          </div>
        )}
      </div>

      {showDenTour && (
        <BotBotTutorial
          isDarkMode={isDarkMode}
          steps={WOLFDEN_TOUR_STEPS}
          state={{ subTab }}
          eyebrowLabel="Den guide"
          onSkip={completeDenTour}
          onComplete={completeDenTour}
        />
      )}
    </div>
  );
};

export default WolfdenWorkspace;
