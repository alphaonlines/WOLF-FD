import React, { useMemo, useState } from "react";
import {
  Activity,
  CheckSquare,
  ChevronDown,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Move,
  ClipboardList,
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
  canViewCard?: (cardId: string) => boolean;
};

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate, canViewCard }) => {
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
        id: "message-board",
        title: "Message Board",
        description: "Announcements and internal updates for the team.",
        details: "This is the internal board for high-visibility notes, operating reminders, and team communication that should stay in front of everyone.",
        cta: "Open Board",
        icon: <ClipboardList size={22} className="text-slate-600" />,
        onClick: () => onNavigate("MESSAGE_BOARD"),
      },
      {
        id: "crm",
        title: "Alpha Pulse CRM",
        description: "Customer follow-up pipeline and lead ownership.",
        details: "Use Alpha Pulse CRM to track lead stage, next actions, and follow-up ownership across the team without mixing it with content analytics.",
        cta: "Open Alpha Pulse CRM",
        icon: <MessageSquare size={22} className="text-indigo-500" />,
        onClick: () => onNavigate("CRM"),
      },
      {
        id: "social-posts",
        title: "Social Posts",
        description: "Content analytics, trends, and post-level performance.",
        details: "Upload social exports, analyze reach and engagement, and tune posting strategy without mixing this workflow into CRM.",
        cta: "Open Social Posts",
        icon: <Activity size={22} className="text-rose-500" />,
        onClick: () => onNavigate("SOCIAL"),
      },
    ];
  }, [onNavigate]);

  const quickLinks = useMemo(
    () => [
      {
        id: "alphapulse",
        label: "AlphaPulse",
        url: "https://furnituredistributors.wolf.discount/alphapulse/",
      },
      {
        id: "fd-connect",
        label: "FD Connect Reviews",
        url: "https://www.furnituredistributors.net/content/connect",
      },
      {
        id: "quicklinks",
        label: "QuickLinks",
        url: "https://sites.google.com/view/fdserver/home",
      },
    ],
    []
  );

  const visibleCards = useMemo(() => {
    if (!canViewCard) return cards;
    return cards.filter((card) => canViewCard(card.id));
  }, [cards, canViewCard]);

  const orderedCards = useMemo(() => {
    if (!order.length) return visibleCards;
    const map = new Map(visibleCards.map((card) => [card.id, card]));
    const arranged = order.map((id) => map.get(id)).filter(Boolean) as SnapshotCard[];
    const remaining = visibleCards.filter((card) => !order.includes(card.id));
    return [...arranged, ...remaining];
  }, [visibleCards, order]);

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
    <div className="space-y-7">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Dashboard Overview</h2>
            <p className="text-sm text-slate-500">Core operations at a glance. Move cards to prioritize your daily workflow.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
            <Move size={14} /> Drag cards to reorder
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick Links</span>
          {quickLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:-translate-y-0.5 hover:bg-slate-50"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedCards.map((card) => card.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedCards.map((card) => (
              <SortableCard key={card.id} id={card.id}>
                <div
                  className={`h-full bg-white border rounded-3xl shadow-sm p-5 flex flex-col justify-between transition-all duration-200 ${
                    expandedCardId === card.id
                      ? "border-sky-200 shadow-md shadow-sky-100/50"
                      : "border-slate-100 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md"
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
                          <div className="h-11 w-11 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 flex items-center justify-center">
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
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm leading-6 text-slate-700">
                          <p className="text-sm font-medium text-slate-900">{card.description}</p>
                          <p className="mt-2">{card.details}</p>
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
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
