import React, { useMemo, useState } from "react";
import {
  Activity,
  CheckSquare,
  ChevronDown,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Move,
  Video,
  Star,
  ClipboardList,
  Bot,
  UploadCloud,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STORAGE_KEY = "fd_dashboard_card_order";

type SnapshotCard = {
  id: string;
  title: string;
  description: string;
  details: string;
  cta: string;
  icon: React.ReactNode;
  onClick: () => void;
  meta?: string;
};

type SortableCardProps = {
  id: string;
  children: React.ReactNode;
};

const SortableCard: React.FC<SortableCardProps> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

type DashboardOverviewProps = {
  onNavigate: (tab: string) => void;
};

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const cards = useMemo<SnapshotCard[]>(() => {
    const openExternal = (url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    };

    return [
      {
        id: "sales",
        title: "Sales Analysis",
        description: "Latest sales performance, margins, and category breakdowns.",
        details: "Use this to review sold dollars, units, margin, category performance, manufacturer mix, and printed summary reports for the selected date range.",
        cta: "Open Sales Analysis",
        icon: <LayoutDashboard size={22} className="text-blue-500" />,
        onClick: () => onNavigate("SALES"),
      },
      {
        id: "tasks",
        title: "Task Manager",
        description: "Track internal store tasks, assignments, and completion status.",
        details: "This is the operating queue for in-store follow-up work, ownership, due dates, and completion tracking across the team.",
        cta: "Open Tasks",
        icon: <CheckSquare size={22} className="text-rose-500" />,
        onClick: () => onNavigate("TASKS"),
      },
      {
        id: "update-db",
        title: "Update Database",
        description: "Upload monthly or weekly POS exports to refresh analytics data.",
        details: "Use this when new POS exports are ready. It pushes the import files into the backend so the sales dashboard and related reports stay current.",
        cta: "Update Data",
        icon: <UploadCloud size={22} className="text-blue-600" />,
        onClick: () => onNavigate("UPDATE"),
      },
      {
        id: "manager-specials",
        title: "Manager Specials",
        description: "Upload new manager special items and update pricing.",
        details: "This opens the manager specials uploader used to publish new items, pricing, and promotional inventory for the specials workflow.",
        cta: "Open Upload",
        icon: <UploadCloud size={22} className="text-indigo-600" />,
        onClick: () => openExternal("https://furnituredistributors.wolf.discount/fd/manager-specials-upload.html"),
      },
      {
        id: "kiosks",
        title: "AlphaOS",
        description: "Live status for each kiosk location and license availability.",
        details: "Check kiosk health, active devices, and license coverage across locations so issues are visible before they affect the floor.",
        cta: "View AlphaOS",
        icon: <Monitor size={22} className="text-emerald-500" />,
        onClick: () => onNavigate("KIOSKS"),
      },
      {
        id: "nightowl",
        title: "Nightowl",
        description: "Camera coverage and status across all locations.",
        details: "Use this to review camera system status and verify surveillance coverage for each location from one place.",
        cta: "Open Nightowl",
        icon: <Video size={22} className="text-slate-700" />,
        onClick: () => onNavigate("CAMERAS"),
      },
      {
        id: "message-board",
        title: "Message Board",
        description: "Announcements and internal updates for the team.",
        details: "This is the internal board for high-visibility notes, operating reminders, and team communication that should stay in front of everyone.",
        cta: "Open Board",
        icon: <ClipboardList size={22} className="text-slate-600" />,
        onClick: () => onNavigate("MESSAGE_BOARD"),
      },
      {
        id: "wolfbot",
        title: "WOLFbot",
        description: "AI call routing and conversational flow management.",
        details: "Open WOLFbot to review how inbound conversations are routed, what intents are captured, and how the automation is currently behaving.",
        cta: "Open WOLFbot",
        icon: <Bot size={22} className="text-slate-700" />,
        onClick: () => onNavigate("WOLFBOT"),
      },
      {
        id: "crm",
        title: "CRM",
        description: "Work advertising activity and customer outreach focus.",
        details: "The CRM area tracks outreach, campaign work, and customer follow-up so advertising activity stays organized and actionable.",
        cta: "Open CRM",
        icon: <MessageSquare size={22} className="text-indigo-500" />,
        onClick: () => onNavigate("CRM"),
      },
      {
        id: "alphapulse",
        title: "AlphaPulse",
        description: "Social analytics dashboard for the Furniture Distributors page.",
        details: "Use AlphaPulse for social performance, engagement movement, and content-level insights tied to the Furniture Distributors presence.",
        cta: "Open AlphaPulse",
        icon: <Activity size={22} className="text-rose-500" />,
        onClick: () => openExternal("https://furnituredistributors.wolf.discount/alphapulse/"),
      },
      {
        id: "fd-connect",
        title: "FD Connect Reviews",
        description: "Monitor and respond to Furniture Distributors reviews.",
        details: "This is the direct path into review monitoring so the team can see new feedback, respond quickly, and protect store reputation.",
        cta: "Open FD Connect",
        icon: <Star size={22} className="text-amber-500" />,
        onClick: () => openExternal("https://www.furnituredistributors.net/content/connect"),
      },
      {
        id: "quicklinks",
        title: "QuickLinks",
        description: "Fast access to the shared internal FD resource hub.",
        details: "QuickLinks opens the central resource page used by the team for day-to-day shortcuts, reference links, and store operations material.",
        cta: "Open QuickLinks",
        icon: <LayoutDashboard size={22} className="text-cyan-600" />,
        onClick: () => openExternal("https://sites.google.com/view/fdserver/home"),
      },
    ];
  }, [onNavigate]);

  const orderedCards = useMemo(() => {
    if (!order.length) return cards;
    const map = new Map(cards.map((card) => [card.id, card]));
    const arranged = order.map((id) => map.get(id)).filter(Boolean) as SnapshotCard[];
    const remaining = cards.filter((card) => !order.includes(card.id));
    return [...arranged, ...remaining];
  }, [cards, order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = orderedCards.map((card) => card.id);
    const oldIndex = current.indexOf(active.id as string);
    const newIndex = current.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(current, oldIndex, newIndex);
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Dashboard Overview</h2>
            <p className="text-sm text-slate-500">Move cards to prioritize the snapshots you need most.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
            <Move size={14} /> Drag cards to reorder
          </div>
        </div>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedCards.map((card) => card.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {orderedCards.map((card) => (
              <SortableCard key={card.id} id={card.id}>
                <div
                  className={`h-full bg-white border rounded-3xl shadow-sm p-6 flex flex-col justify-between transition-all duration-200 ${
                    expandedCardId === card.id
                      ? "border-blue-200 shadow-lg shadow-blue-100/60"
                      : "border-slate-100 hover:border-slate-200 hover:shadow-md"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedCardId((current) => (current === card.id ? null : card.id))}
                    className="w-full text-left bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-slate-50 flex items-center justify-center">
                            {card.icon}
                          </div>
                          <div>
                            <div className="text-base font-semibold text-slate-900">{card.title}</div>
                            {card.meta && <div className="text-xs text-slate-400">{card.meta}</div>}
                          </div>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                            expandedCardId === card.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                      {expandedCardId === card.id && (
                        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                          <p className="text-sm font-medium text-slate-900">{card.description}</p>
                          <p className="mt-2">{card.details}</p>
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    onClick={(event) => {
                      event.stopPropagation();
                      card.onClick();
                    }}
                  >
                    {card.cta}
                  </button>
                </div>
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default DashboardOverview;
