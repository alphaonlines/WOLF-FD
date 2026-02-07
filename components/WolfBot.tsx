import React, { useMemo } from "react";
import {
  Bot,
  Calendar,
  ChevronRight,
  Globe,
  MessageSquare,
  PhoneCall,
  Plus,
  Send,
  Settings,
  Users,
  Wand2,
} from "lucide-react";

type CallItem = {
  id: string;
  caller: string;
  intent: string;
  outcome: string;
  time: string;
};

type FlowItem = {
  id: string;
  name: string;
  trigger: string;
  status: "Active" | "Draft";
};

type RouteItem = {
  id: string;
  label: string;
  number: string;
};

const WolfBot: React.FC = () => {
  const calls = useMemo<CallItem[]>(
    () => [
      { id: "c1", caller: "+1 (336) 555-1021", intent: "Store hours", outcome: "Auto-resolved", time: "Today · 10:12 AM" },
      { id: "c2", caller: "+1 (704) 555-4223", intent: "Delivery update", outcome: "Routed to FD7", time: "Today · 9:40 AM" },
      { id: "c3", caller: "+1 (828) 555-1189", intent: "Finance options", outcome: "Voicemail captured", time: "Yesterday · 5:18 PM" },
    ],
    []
  );

  const flows = useMemo<FlowItem[]>(
    () => [
      { id: "f1", name: "Main Greeting", trigger: "Incoming call", status: "Active" },
      { id: "f2", name: "Delivery Status", trigger: "Intent: delivery", status: "Active" },
      { id: "f3", name: "Store Routing", trigger: "Intent: store info", status: "Draft" },
    ],
    []
  );

  const routes = useMemo<RouteItem[]>(
    () => [
      { id: "r1", label: "FD5 Sales", number: "+1 (336) 555-9001" },
      { id: "r2", label: "FD7 Sales", number: "+1 (336) 555-9002" },
      { id: "r3", label: "Delivery Desk", number: "+1 (336) 555-9003" },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Owner Console</div>
            <h2 className="text-2xl font-semibold text-slate-900">WOLFbot</h2>
            <p className="text-sm text-slate-500">
              Multilingual AI assistant powered by Google Conversational Agents (Dialogflow). Manage greetings,
              call routing, and conversational flows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> New Flow
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
              <Settings size={16} /> Bot Settings
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Active Flows</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">3</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Calls Today</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">18</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Auto-resolved</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">61%</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Languages</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">4</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="text-xs uppercase tracking-wide text-slate-500">Bot Chat</div>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Previous Chats</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <button className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900">
                FD7 Hours Test
                <div className="text-xs text-slate-400 mt-1">Today · 10:05 AM</div>
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600">
                Delivery Status
                <div className="text-xs text-slate-400 mt-1">Yesterday · 4:18 PM</div>
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600">
                Finance Options
                <div className="text-xs text-slate-400 mt-1">Yesterday · 11:02 AM</div>
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex-1 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-xs text-slate-400">WOLFbot</div>
                <div>Hi! I can help route calls or capture messages.</div>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-xs text-slate-400">You</div>
                <div>Test: store hours for FD7</div>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-xs text-slate-400">WOLFbot</div>
                <div>FD7 hours are 10 AM – 7 PM. Want directions?</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <input
                type="text"
                placeholder="Send a test message..."
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <button className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                <Send size={12} /> Send
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Recent Conversations</h3>
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <Calendar size={14} /> Last 7 Days
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {calls.map((call) => (
                <div key={call.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{call.caller}</div>
                    <span className="text-xs text-slate-400">{call.time}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">Intent: {call.intent}</div>
                  <div className="mt-2 text-xs text-slate-500">Outcome: {call.outcome}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Conversational Flows</h3>
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <Wand2 size={14} /> Edit Flow
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {flows.map((flow) => (
                <div key={flow.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{flow.name}</div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      flow.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    }`}>
                      {flow.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Trigger: {flow.trigger}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Routing Lines</div>
            <div className="mt-3 space-y-3">
              {routes.map((route) => (
                <div key={route.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{route.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{route.number}</div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>
              ))}
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                <Plus size={14} /> Add Route
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Live Controls</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <MessageSquare size={14} /> Update greeting
              </button>
              <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <PhoneCall size={14} /> Test call routing
              </button>
              <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <Bot size={14} /> Train intents
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Languages</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2"><Globe size={14} /> English</span>
                <span className="text-xs font-semibold">Primary</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2"><Globe size={14} /> Spanish</span>
                <span className="text-xs font-semibold">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2"><Globe size={14} /> French</span>
                <span className="text-xs font-semibold">Draft</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WolfBot;
