import React, { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Tag,
  User,
  Users,
  Wand2,
} from "lucide-react";

type TabKey = "planner" | "inbox" | "reviews" | "flows" | "customers" | "analytics";

type PlanCard = {
  id: string;
  title: string;
  channel: string;
  time: string;
  status: "Scheduled" | "Draft" | "Needs Review";
};

type InboxThread = {
  id: string;
  name: string;
  channel: string;
  preview: string;
  status: "Open" | "Waiting" | "Resolved";
  tags: string[];
};

type ReviewItem = {
  id: string;
  location: string;
  rating: number;
  summary: string;
  status: "Needs Response" | "Replied";
};

type FlowCard = {
  id: string;
  name: string;
  trigger: string;
  steps: string[];
};

type CustomerItem = {
  id: string;
  name: string;
  store: string;
  lastTouch: string;
  status: "Active" | "Needs Follow-up";
};

const WorkAdvertising: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("planner");

  const plannerCards = useMemo<PlanCard[]>(
    () => [
      { id: "p1", title: "Weekend Sofa Promo", channel: "Instagram", time: "Fri · 10:30 AM", status: "Scheduled" },
      { id: "p2", title: "Delivery Window Update", channel: "Facebook", time: "Fri · 3:00 PM", status: "Needs Review" },
      { id: "p3", title: "New Bedroom Line", channel: "Google", time: "Mon · 9:00 AM", status: "Draft" },
      { id: "p4", title: "Email: Spring Refresh", channel: "Email", time: "Tue · 11:00 AM", status: "Scheduled" },
    ],
    []
  );

  const inboxThreads = useMemo<InboxThread[]>(
    () => [
      {
        id: "t1",
        name: "Sharon Wells",
        channel: "SMS",
        preview: "Can I change delivery to Saturday?",
        status: "Open",
        tags: ["Delivery", "FD7"],
      },
      {
        id: "t2",
        name: "Marcus Lee",
        channel: "Instagram",
        preview: "Do you have the Aspen sectional in stock?",
        status: "Waiting",
        tags: ["Sales Lead", "FD5"],
      },
      {
        id: "t3",
        name: "Adrian Price",
        channel: "Email",
        preview: "Thanks for the follow-up!",
        status: "Resolved",
        tags: ["Review", "Base"],
      },
    ],
    []
  );

  const reviewItems = useMemo<ReviewItem[]>(
    () => [
      { id: "r1", location: "FD7", rating: 4, summary: "Great service, delivery was early.", status: "Needs Response" },
      { id: "r2", location: "G1", rating: 5, summary: "Loved the new showroom layout.", status: "Replied" },
      { id: "r3", location: "FD5", rating: 3, summary: "Had to wait a bit for pickup.", status: "Needs Response" },
    ],
    []
  );

  const flowCards = useMemo<FlowCard[]>(
    () => [
      {
        id: "f1",
        name: "New Lead Follow-Up",
        trigger: "New lead created",
        steps: ["SMS intro", "Wait 2 days", "Email lookbook", "Check-in text"],
      },
      {
        id: "f2",
        name: "Delivery Complete",
        trigger: "Delivery marked complete",
        steps: ["Thank you SMS", "Wait 3 days", "Review request"],
      },
      {
        id: "f3",
        name: "Quote Follow-Up",
        trigger: "Quote not closed in 5 days",
        steps: ["Reminder email", "Wait 2 days", "Offer text"],
      },
    ],
    []
  );

  const customers = useMemo<CustomerItem[]>(
    () => [
      { id: "c1", name: "Amber Davis", store: "FD7", lastTouch: "2 days ago", status: "Active" },
      { id: "c2", name: "Corey Banks", store: "FD5", lastTouch: "5 days ago", status: "Needs Follow-up" },
      { id: "c3", name: "Tara Simmons", store: "Base", lastTouch: "Today", status: "Active" },
    ],
    []
  );

  const stats = [
    { label: "Posts scheduled", value: "28" },
    { label: "Open conversations", value: "14" },
    { label: "Reviews to respond", value: "6" },
    { label: "Avg response time", value: "18m" },
  ];

  const renderTabButton = (key: TabKey, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setActiveTab(key)}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        activeTab === key
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">CRM Command Center</div>
            <h2 className="text-2xl font-semibold text-slate-900">CRM + Social Planner</h2>
            <p className="text-sm text-slate-500">Schedule posts, manage conversations, and run drip flows in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> New Campaign
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
              <Wand2 size={16} /> Generate Template
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {renderTabButton("planner", "Planner")}
          {renderTabButton("inbox", "Inbox")}
          {renderTabButton("reviews", "Reviews")}
          {renderTabButton("flows", "Drip Flows")}
          {renderTabButton("customers", "Customers")}
          {renderTabButton("analytics", "Analytics")}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</div>
          </div>
        ))}
      </section>

      {activeTab === "planner" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Scheduled Content</h3>
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <Calendar size={14} /> Calendar View
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {plannerCards.map((card) => (
                <div key={card.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{card.title}</div>
                  <div className="mt-2 text-xs text-slate-500">{card.channel} · {card.time}</div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-600">
                    <Clock size={12} /> {card.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Queue</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Evergreen Inventory</div>
                  <div className="text-xs text-slate-500 mt-1">6 drafts ready</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Weekend Promo</div>
                  <div className="text-xs text-slate-500 mt-1">Next slot: Sat 11:00 AM</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Channels</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Instagram</span>
                  <span className="text-xs font-semibold">9 queued</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Facebook</span>
                  <span className="text-xs font-semibold">6 queued</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Email</span>
                  <span className="text-xs font-semibold">3 queued</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "inbox" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Unified Inbox</h3>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Search size={14} /> Search
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {inboxThreads.map((thread) => (
                <div key={thread.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{thread.name}</div>
                    <span className="text-xs font-semibold rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                      {thread.channel}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{thread.preview}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {thread.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Tag size={12} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Templates</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Delivery update</span>
                  <ChevronRight size={14} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Review request</span>
                  <ChevronRight size={14} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Quote follow-up</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Quick Actions</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                  <MessageSquare size={14} /> Send SMS
                </button>
                <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                  <Mail size={14} /> Send Email
                </button>
                <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                  <Phone size={14} /> Log Call
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "reviews" && (
        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Reviews</h3>
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              <CheckCircle2 size={14} /> Respond Queue
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {reviewItems.map((review) => (
              <div key={review.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">{review.location}</div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    review.status === "Needs Response"
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-emerald-100 text-emerald-700 border-emerald-200"
                  }`}>
                    {review.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-600">{review.summary}</div>
                <div className="mt-2 text-xs text-slate-500">Rating: {review.rating}★</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "flows" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Drip Flows</h3>
              <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                <Plus size={14} /> New Flow
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {flowCards.map((flow) => (
                <div key={flow.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{flow.name}</div>
                  <div className="mt-2 text-xs text-slate-500">Trigger: {flow.trigger}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flow.steps.map((step) => (
                      <span key={step} className="text-xs text-slate-600 rounded-full border border-slate-200 bg-white px-3 py-1">
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Flow Builder</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Start Trigger</div>
                  <div className="text-xs text-slate-500">Lead created</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Send SMS</div>
                  <div className="text-xs text-slate-500">"Thanks for reaching out!"</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Wait 2 days</div>
                  <div className="text-xs text-slate-500">Then send email lookbook</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Quick Templates</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>New lead flow</span>
                  <ChevronRight size={14} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery complete</span>
                  <ChevronRight size={14} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Quote follow-up</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "customers" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Customers</h3>
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <Plus size={14} /> Add Customer
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {customers.map((customer) => (
                <div key={customer.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{customer.name}</div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                      customer.status === "Needs Follow-up"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-emerald-100 text-emerald-700 border-emerald-200"
                    }`}>
                      {customer.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Store: {customer.store} · Last touch: {customer.lastTouch}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Templates</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Quote follow-up</span>
                  <ChevronRight size={14} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery check-in</span>
                  <ChevronRight size={14} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Review request</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">Quick Contact</div>
              <div className="mt-3 space-y-2">
                <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  <Send size={14} /> Send SMS
                </button>
                <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  <Mail size={14} /> Send Email
                </button>
                <button className="w-full inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  <Phone size={14} /> Call
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "analytics" && (
        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">CRM Analytics</h3>
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              <Calendar size={14} /> Last 30 Days
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Response rate</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">92%</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Average reply time</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">19 min</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Review growth</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">+28</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
            Analytics tiles will connect to live data once integrations are wired in.
          </div>
        </section>
      )}
    </div>
  );
};

export default WorkAdvertising;
