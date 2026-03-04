import React, { useMemo } from "react";
import { CalendarCheck2, PhoneCall, UserRound, UsersRound } from "lucide-react";

type LeadItem = {
  id: string;
  customer: string;
  stage: "New" | "Follow-up" | "Quoted" | "Closed";
  owner: string;
  nextStep: string;
  due: string;
};

const CRMWorkspace: React.FC = () => {
  const leads = useMemo<LeadItem[]>(
    () => [
      {
        id: "l1",
        customer: "Jordan Family",
        stage: "New",
        owner: "FD7 Team",
        nextStep: "Confirm preferred sectional layout",
        due: "Today",
      },
      {
        id: "l2",
        customer: "Miller Home",
        stage: "Follow-up",
        owner: "FD5 Team",
        nextStep: "Call back on financing options",
        due: "Tomorrow",
      },
      {
        id: "l3",
        customer: "Avery Retail",
        stage: "Quoted",
        owner: "Commercial Desk",
        nextStep: "Send revised dining package quote",
        due: "Fri",
      },
      {
        id: "l4",
        customer: "Patel Residence",
        stage: "Closed",
        owner: "FD51 Team",
        nextStep: "Schedule delivery confirmation",
        due: "Completed",
      },
    ],
    []
  );

  const stats = useMemo(() => {
    const open = leads.filter((lead) => lead.stage !== "Closed").length;
    const followUp = leads.filter((lead) => lead.stage === "Follow-up").length;
    const quoted = leads.filter((lead) => lead.stage === "Quoted").length;
    const closed = leads.filter((lead) => lead.stage === "Closed").length;
    return { open, followUp, quoted, closed };
  }, [leads]);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">CRM Workspace</div>
            <h2 className="text-2xl font-semibold text-slate-900">Customer Follow-up Pipeline</h2>
            <p className="text-sm text-slate-500">
              Track leads, outreach, and next actions independent from social media posting analytics.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            <PhoneCall size={16} /> Log Follow-up
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Open Leads</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{stats.open}</div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="text-xs uppercase tracking-wide text-amber-700">Needs Follow-up</div>
            <div className="mt-2 text-2xl font-semibold text-amber-900">{stats.followUp}</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-xs uppercase tracking-wide text-blue-700">Quoted</div>
            <div className="mt-2 text-2xl font-semibold text-blue-900">{stats.quoted}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Closed</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900">{stats.closed}</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Active Pipeline</h3>
          <span className="text-xs uppercase tracking-wide text-slate-500">Demo data</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-6">Customer</th>
                <th className="py-3 pr-6">Stage</th>
                <th className="py-3 pr-6">Owner</th>
                <th className="py-3 pr-6">Next Step</th>
                <th className="py-3 pr-6">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="py-3 pr-6 font-semibold text-slate-900">{lead.customer}</td>
                  <td className="py-3 pr-6">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                        lead.stage === "Closed"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : lead.stage === "Quoted"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : lead.stage === "Follow-up"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {lead.stage}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-slate-700">{lead.owner}</td>
                  <td className="py-3 pr-6 text-slate-700">{lead.nextStep}</td>
                  <td className="py-3 pr-6 text-slate-700">{lead.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <UsersRound size={14} /> Team Queue
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Keep ownership clear by assigning every follow-up to a specific store or rep.
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <CalendarCheck2 size={14} /> Next Touch
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Prioritize callbacks due in the next 24 hours so hot leads never go cold.
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <UserRound size={14} /> Customer Notes
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Capture style preferences, budget range, and objections to improve close rate.
          </p>
        </div>
      </section>
    </div>
  );
};

export default CRMWorkspace;
