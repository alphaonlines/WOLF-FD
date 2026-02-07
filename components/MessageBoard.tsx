import React, { useMemo, useState } from "react";
import {
  Hash,
  Lock,
  PhoneCall,
  Plus,
  Search,
  Send,
  User,
  Users,
  Video,
} from "lucide-react";

type Channel = {
  id: string;
  name: string;
  isPrivate?: boolean;
  unread?: number;
};

type DirectMessage = {
  id: string;
  name: string;
  status: "online" | "away" | "offline";
};

type Message = {
  id: string;
  author: string;
  time: string;
  body: string;
  emphasis?: boolean;
};

type TaskItem = {
  id: string;
  title: string;
  owner: string;
  due: string;
  status: "Open" | "In Progress" | "Done";
};

const MessageBoard: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState("announcements");
  const channels = useMemo<Channel[]>(
    () => [
      { id: "announcements", name: "announcements", unread: 2 },
      { id: "sales-floor", name: "sales-floor" },
      { id: "operations", name: "operations" },
      { id: "inventory", name: "inventory" },
      { id: "marketing", name: "marketing" },
      { id: "leadership", name: "leadership", isPrivate: true },
    ],
    []
  );

  const dms = useMemo<DirectMessage[]>(
    () => [
      { id: "jane", name: "Jane Cooper", status: "online" },
      { id: "marvin", name: "Marvin Hawkins", status: "away" },
      { id: "wendy", name: "Wendy Riley", status: "online" },
      { id: "cody", name: "Cody Fisher", status: "offline" },
    ],
    []
  );

  const messages = useMemo<Message[]>(
    () => [
      {
        id: "m1",
        author: "Store Ops",
        time: "8:12 AM",
        body: "FD7 showroom reset starts at 9:30. Merchandising team please confirm setup checklist.",
        emphasis: true,
      },
      {
        id: "m2",
        author: "Jordan Lee",
        time: "8:18 AM",
        body: "Inventory counts for base location are in. No backorder risks today.",
      },
      {
        id: "m3",
        author: "Avery Stone",
        time: "8:26 AM",
        body: "Reminder: customer follow-up calls due by 2 PM. Use the CRM notes template.",
      },
    ],
    []
  );

  const tasks = useMemo<TaskItem[]>(
    () => [
      { id: "t1", title: "Review response for FD5", owner: "Marketing", due: "Today", status: "Open" },
      { id: "t2", title: "Schedule weekend promo", owner: "Social", due: "Tomorrow", status: "In Progress" },
      { id: "t3", title: "Follow up delivery feedback", owner: "Ops", due: "Fri", status: "Done" },
    ],
    []
  );

  const activeChannelLabel = channels.find((c) => c.id === activeChannel)?.name ?? "announcements";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="space-y-6">
        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Message Board</div>
              <div className="text-xs text-slate-500">Channels + DMs</div>
            </div>
            <button
              type="button"
              className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              title="Add channel"
            >
              <Plus size={16} className="mx-auto" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Search size={14} />
            Search
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Channels</div>
          <div className="mt-3 space-y-1">
            {channels.map((channel) => {
              const isActive = channel.id === activeChannel;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setActiveChannel(channel.id)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {channel.isPrivate ? <Lock size={14} /> : <Hash size={14} />}
                    {channel.name}
                  </span>
                  {channel.unread ? (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {channel.unread}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direct Messages</div>
            <button
              type="button"
              className="text-xs text-blue-600 font-semibold hover:text-blue-700"
            >
              New
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {dms.map((dm) => (
              <div
                key={dm.id}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      dm.status === "online"
                        ? "bg-emerald-500"
                        : dm.status === "away"
                          ? "bg-amber-400"
                          : "bg-slate-300"
                    }`}
                  />
                  {dm.name}
                </span>
                <User size={14} />
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="space-y-6">
        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Channel</div>
              <h2 className="text-2xl font-semibold text-slate-900">#{activeChannelLabel}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                <Users size={14} /> 12 online
              </button>
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                <Video size={14} /> Start video
              </button>
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                <PhoneCall size={14} /> Audio room
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-semibold">
                  {message.author.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">{message.author}</span>
                    <span className="text-xs text-slate-400">{message.time}</span>
                    {message.emphasis && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Priority
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{message.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Compose</div>
              <div className="text-sm text-slate-600">Send updates to this channel.</div>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
            >
              <Plus size={14} /> Attach
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="text"
              placeholder="Share an update with your team..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              <Send size={14} /> Send
            </button>
          </div>
        </section>
      </main>

      <aside className="space-y-6">
        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</div>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">New</button>
          </div>
          <div className="mt-3 space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      task.status === "Done"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : task.status === "In Progress"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">Owner: {task.owner} · Due: {task.due}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Voice + Video</div>
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Daily Standup</div>
                  <div className="text-xs text-slate-500">9:30 AM · 8 participants</div>
                </div>
                <button className="rounded-full bg-emerald-500 text-white text-xs font-semibold px-3 py-1">
                  Join
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Sales Coaching</div>
              <div className="text-xs text-slate-500 mt-1">Next: 2:00 PM · Host: Anna</div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pinned</div>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Manager checklist</div>
              <div className="text-xs text-slate-500 mt-1">Updated yesterday</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Weekend promo brief</div>
              <div className="text-xs text-slate-500 mt-1">Updated 2 days ago</div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
};

export default MessageBoard;
