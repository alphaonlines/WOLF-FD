import React, { useEffect, useState, useCallback } from "react";
import { X, ChevronRight, RefreshCw, Send, ThumbsUp, Plus, Check, Copy } from "lucide-react";
import { createTaskInApi } from "../../services/tasksApi";
import { TaskStatus } from "../../types";
import {
  fetchObjectionVotes,
  castObjectionVote,
  removeObjectionVote,
  type VoteCounts,
  type UserVotes,
} from "../../services/objectionVotesApi";
import { fetchCustomObjections, type CustomObjection } from "../../services/customObjectionsApi";

type Objection = {
  id: string;
  label: string;
  rebuttals: string[];
};

const BASE_OBJECTIONS: Objection[] = [
  {
    id: "too-expensive",
    label: "It's too expensive / out of my budget",
    rebuttals: [
      "I totally understand — budget matters. Let's break it down monthly. Most of our financing options come out to less than a cup of coffee a day, and you're sitting on it every single day.",
      "Great furniture is something you use every day for years. What price point do you need to be at? Let me see what I can find in that range — you might be surprised.",
      "Compare the cost per year over the life of the piece. Quality furniture lasts 10–20 years. Cheap alternatives often cost more in replacements and frustration.",
      "We have flexible financing with no-interest options for qualifying customers. Would spreading it out make this work for you today?",
      "Let me show you what we have in your range. There are options at every level — I just want to make sure you're leaving with something you love.",
    ],
  },
  {
    id: "think-about-it",
    label: "I need to think about it",
    rebuttals: [
      "Absolutely — what specifically is holding you back? If we can clear that up right now, it might save you a trip back.",
      "That's fair. Most people are weighing price, quality, or fit. Which one is it for you? Let's tackle it head-on.",
      "I respect that. Just know our inventory moves fast — I can't guarantee this exact piece will be here when you return.",
      "What would make the decision easier for you right now? I want to make sure you have everything you need.",
      "Is there someone else involved in the decision? We could call them together or I can put a summary together for them to review.",
    ],
  },
  {
    id: "spouse",
    label: "I need to talk to my spouse / partner first",
    rebuttals: [
      "Of course — big decisions are better together. What do you think their main concern would be? Let's make sure you have an answer ready.",
      "Can we give them a quick call right now so I can answer their questions directly? I'd love to help close the loop while you're here.",
      "Let me put together a quick package — photos, pricing, and dimensions — so the conversation at home is easy and they have all the info.",
      "What would it take for you to feel confident presenting this to them? I can help you build that case.",
      "Could you shoot them a quick text with a photo while you're here? I'd hate for this piece to be gone before they see it.",
    ],
  },
  {
    id: "cheaper-online",
    label: "I can get it cheaper online",
    rebuttals: [
      "You might find a lower number online — but who delivers it, assembles it, and handles it if something goes wrong? That's what you're getting here.",
      "Online prices rarely include delivery, setup, or haul-away. Let's do a true apples-to-apples comparison with all the fees included.",
      "A lot of online furniture looks great in photos but feels completely different. Would you buy a mattress without trying it first?",
      "Online reviews are full of people who got their furniture damaged in shipping with no one to call. Here, we show up, set it up, and stand behind it.",
      "The return process for large furniture bought online is a nightmare — damages, shipping fees, scheduling pickups. Here, we handle everything.",
    ],
  },
  {
    id: "just-browsing",
    label: "I'm just browsing / not ready to buy",
    rebuttals: [
      "Perfect — no pressure at all. What brought you in today? Even if you're not buying, I can point you in the right direction and save you time.",
      "That's the best way to shop! Is there a particular room or piece you had in mind? I can narrow it down for you.",
      "Take your time. I'll be nearby — if anything catches your eye or you have questions, just wave me over.",
      "Most people who 'just browse' leave with something they didn't expect to love. What does your living room look like right now?",
      "Browsing is how you find things you didn't know you needed. What style are you drawn to — modern, traditional, casual?",
    ],
  },
  {
    id: "delivery-cost",
    label: "I don't want to pay for delivery",
    rebuttals: [
      "I get it — it feels like an extra hit. But factor in renting a truck, the time, and the risk of damage to a piece you just paid for. Our team handles everything professionally.",
      "Our delivery includes full setup and haul-away of your old furniture. Try getting that with a rental truck.",
      "We can often roll delivery into financing so it's part of your monthly payment — no upfront cost at all.",
      "Our team delivers, assembles, and positions everything exactly where you want it. That's a service, not just a fee.",
      "Our delivery team does a full white-glove inspection before they leave your home. That peace of mind alone is worth it.",
    ],
  },
  {
    id: "prices-up",
    label: "Prices have gone up so much / it used to be cheaper",
    rebuttals: [
      "You're absolutely right, and I won't pretend otherwise. Materials, shipping, and labor have all increased industry-wide. What I can tell you is that what you see today is locked in.",
      "Waiting typically means paying more, not less. The brands we carry have held prices as long as they possibly can.",
      "It's a tough environment for everyone. That's exactly why locking in today's price with financing makes sense — you pay today's rate spread over time.",
      "We work hard to keep our margins fair even as our costs go up. What you're getting here is quality that outlasts the price increase many times over.",
      "I hear this a lot and it's valid. The good news: what you're looking at today is likely the floor, not the ceiling. Acting now protects you from the next increase.",
    ],
  },
  {
    id: "competitor-price",
    label: "I saw it cheaper at a competitor",
    rebuttals: [
      "I appreciate you being upfront. Are you comparing the exact same model, fabric, and specs? Sometimes it looks identical but the construction is completely different.",
      "Even if their price is a little lower, what's their delivery timeline, warranty, and service after the sale like? That matters a lot.",
      "We stand behind everything we sell. If there's an issue, we make it right — can the other option say the same?",
      "What price point do you need to be at? Let me see what fits in that range — I want to make sure you're leaving with something you love.",
      "The difference in service, warranty, and peace of mind is where the real value lives. Let me show you what that looks like here.",
    ],
  },
  {
    id: "need-to-measure",
    label: "I need to measure / check if it fits",
    rebuttals: [
      "Smart move — let me grab a tape measure right now so you leave with the exact dimensions in hand.",
      "We can hold it for 48 hours with no commitment while you verify at home. Does that give you enough time?",
      "Here's a trick: tape the dimensions on your floor at home to visualize the footprint. It's shockingly helpful.",
      "I can give you a full spec sheet with every dimension. Most people are surprised how well things actually fit.",
      "We offer free in-home design consultations. Want me to set one up so we can verify before you commit?",
    ],
  },
  {
    id: "not-in-a-hurry",
    label: "I'm not in a hurry / don't need it right now",
    rebuttals: [
      "That actually puts you in the best position to shop smart — no pressure, no settling. Let's find exactly what you want.",
      "No rush at all. The only thing I'd mention is that our inventory changes constantly — popular pieces don't wait.",
      "If you find something you love today, we can schedule delivery for whenever you're ready. No rush on your end.",
      "Buying when you're not under pressure means you get exactly what you want, not just what's available when you need it fast.",
      "Would you like to put a small hold on it? That way it's there when the time is right and you're not starting from scratch.",
    ],
  },
  {
    id: "long-wait",
    label: "The lead time / wait is too long",
    rebuttals: [
      "Let me check what we have in stock right now — we may have something available for delivery much sooner than you'd expect.",
      "Supply chains are still recovering across the industry. The brands with the longest waits are usually the most in-demand for good reason.",
      "We have floor samples available immediately. Want to see what's ready to go out the door today?",
      "If you order today, you'd have it by approximately [date]. What's your actual timeline looking like?",
      "The wait goes faster than it sounds — and you'll have something in your home for years. It's worth getting the right piece.",
    ],
  },
  {
    id: "color-fabric",
    label: "I don't like the color / fabric options",
    rebuttals: [
      "We have far more options than what's on the floor. Let me pull up the full swatch book — there are dozens of colors and textures to choose from.",
      "A lot of our pieces are fully customizable. What color are you picturing in your space? Let's find it.",
      "Show me a photo of your room and let's find something that ties it all together perfectly.",
      "If nothing here speaks to you, I can check the manufacturer's current lineup — they often have options we don't have on display.",
      "What you see is just a starting point. Most customers end up ordering in a custom color they love.",
    ],
  },
  {
    id: "quality-worry",
    label: "I'm worried about quality / durability",
    rebuttals: [
      "That's the right question to ask. Let me show you the frame construction — solid hardwood, eight-way hand-tied springs. This isn't particle board.",
      "All of our pieces come with a manufacturer warranty. Let me walk you through exactly what's covered and for how long.",
      "The brands we carry have been in business for decades. That kind of longevity doesn't happen by accident.",
      "Feel free to really test it — sit on it, open it, push it around. We want you to feel completely confident before you decide.",
      "I've seen what happens to cheap furniture after two years. The pieces here are built to last a decade or more.",
    ],
  },
  {
    id: "financing",
    label: "Financing concerns / worried about credit",
    rebuttals: [
      "We work with multiple lenders which means more chances for approval. It never hurts to apply — it takes two minutes and I'll walk you through it.",
      "We have options for all kinds of credit situations. Let's just see what fits your profile — no commitment required to look.",
      "We run a soft inquiry first, so it won't hurt your score just to see what you qualify for.",
      "We also have lease-to-own options that don't require traditional credit approval — worth knowing about.",
      "Your situation may be better than you think. Let's just run it and see what comes back before we assume anything.",
    ],
  },
];

let OBJECTIONS: Objection[] = [...BASE_OBJECTIONS];

const pickRandom = <T,>(arr: T[], exclude?: T): T => {
  const pool = arr.length > 1 ? arr.filter((item) => item !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
};

type Props = {
  isDarkMode: boolean;
};

const ObjectionsDrawer: React.FC<Props> = ({ isDarkMode }) => {
  const [open, setOpen] = useState(false);
  const [currentObjection, setCurrentObjection] = useState<Objection | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitText, setSubmitText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Voting state
  const [votes, setVotes] = useState<VoteCounts>({});
  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const [votesLoaded, setVotesLoaded] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Initialize with random objection when drawer first opens
  const initializeObjection = useCallback(() => {
    if (OBJECTIONS.length > 0 && !currentObjection) {
      setCurrentObjection(pickRandom(OBJECTIONS));
    }
  }, [currentObjection]);

  // Load votes when drawer opens
  useEffect(() => {
    if (!open || votesLoaded) return;
    fetchObjectionVotes()
      .then(({ votes: v, userVotes: uv }) => {
        setVotes(v);
        setUserVotes(uv);
        setVotesLoaded(true);
      })
      .catch(() => setVotesLoaded(true));
  }, [open, votesLoaded]);

  // Load custom objections from DB and merge with BASE_OBJECTIONS
  useEffect(() => {
    if (!open) return;
    const loadCustomObjections = async () => {
      try {
        const customObj = await fetchCustomObjections();
        const customObjections: Objection[] = customObj.map((c: CustomObjection) => ({
          id: c.objection_id || `custom-${c.id}`,
          label: c.label,
          rebuttals: c.rebuttals || [],
        }));
        OBJECTIONS = [...BASE_OBJECTIONS, ...customObjections];
      } catch {
        OBJECTIONS = [...BASE_OBJECTIONS];
      }
      initializeObjection();
    };
    loadCustomObjections();
  }, [open, initializeObjection]);

  const handleTryAnother = () => {
    setCurrentObjection(pickRandom(OBJECTIONS, currentObjection!));
  };

  const handleUseRebuttal = async (rebuttal: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(rebuttal);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleVote = async (objectionId: string, rebuttalIndex: number) => {
    const key = `${objectionId}-${rebuttalIndex}`;
    if (votingId) return;
    const alreadyVoted = userVotes[objectionId] === rebuttalIndex;
    setVotingId(key);

    // Optimistic update
    setVotes((prev) => {
      const next = { ...prev };
      const obj = { ...(next[objectionId] || {}) };
      if (alreadyVoted) {
        obj[rebuttalIndex] = Math.max(0, (obj[rebuttalIndex] || 1) - 1);
      } else {
        const oldIdx = userVotes[objectionId];
        if (oldIdx !== undefined && obj[oldIdx]) {
          obj[oldIdx] = Math.max(0, (obj[oldIdx] || 1) - 1);
        }
        obj[rebuttalIndex] = (obj[rebuttalIndex] || 0) + 1;
      }
      next[objectionId] = obj;
      return next;
    });
    setUserVotes((prev) => {
      if (alreadyVoted) {
        const next = { ...prev };
        delete next[objectionId];
        return next;
      }
      return { ...prev, [objectionId]: rebuttalIndex };
    });

    try {
      if (alreadyVoted) {
        await removeObjectionVote(objectionId);
      } else {
        await castObjectionVote(objectionId, rebuttalIndex);
      }
    } catch {
      // Revert on failure — re-fetch
      fetchObjectionVotes()
        .then(({ votes: v, userVotes: uv }) => { setVotes(v); setUserVotes(uv); })
        .catch(() => {});
    } finally {
      setVotingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = submitText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await createTaskInApi({
        title: `Objection Suggestion: ${text}`,
        assignee: "Support",
        status: TaskStatus.TODO,
        priority: "medium",
        deadline: "",
        sortIndex: 0,
        taskType: "objection_submission",
        taskMeta: { submitted_text: text },
      });
      setSubmitted(true);
      setSubmitText("");
      setShowSubmitForm(false);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      setSubmitted(true);
      setSubmitText("");
      setShowSubmitForm(false);
      setTimeout(() => setSubmitted(false), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const panelBg = isDarkMode
    ? "bg-slate-950 border-slate-800"
    : "bg-white border-slate-200";
  const inputCls = isDarkMode
    ? "rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
    : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-200/60";
  const sectionLabel = `text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`;
  const cardCls = isDarkMode
    ? "rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
    : "rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3";

  const totalVotesForObjection = (objId: string) => {
    const obj = votes[objId] || {};
    return Object.values(obj).reduce((a, b) => a + b, 0);
  };

  const currentObj = currentObjection;

  return (
    <>
      {/* Pull tab - vertical, anchored to right edge */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed top-40 right-0 z-40 flex flex-col items-center gap-2 rounded-l-lg border-y border-l px-3 py-5 shadow-lg transition-all ${
          isDarkMode
            ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
        title="Objection Handlers"
      >
        <ChevronRight
          size={18}
          className="transition-transform rotate-180"
        />
        <span className="text-xs font-bold uppercase tracking-wider [writing-mode:vertical-rl]">
          Objections
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer - from right */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto border-l shadow-2xl transition-transform duration-300 ${panelBg} ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className={`flex items-center justify-between border-b px-4 py-4 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
          <div>
            <div className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Objection Handlers
            </div>
            <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {OBJECTIONS.length} furniture objection{OBJECTIONS.length !== 1 ? "s" : ""} with rebuttals
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className={`rounded-full p-1.5 transition ${isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-4 py-5">
          {/* Current objection display */}
          {currentObj ? (
            <div>
              <div className="flex items-center justify-between">
                <div className={sectionLabel}>Objection</div>
                <button
                  onClick={handleTryAnother}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isDarkMode
                      ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                      : "border-slate-200 text-slate-600 hover:bg-white"
                  }`}
                >
                  <RefreshCw size={12} />
                  Try Another
                </button>
              </div>
              <div className={`mt-2 ${cardCls}`}>
                <div className={`text-sm font-semibold ${isDarkMode ? "text-amber-300" : "text-amber-700"}`}>
                  "{currentObj.label}"
                </div>
              </div>
            </div>
          ) : (
            <div className={sectionLabel}>Loading objection...</div>
          )}

          {/* All rebuttals with voting */}
          {currentObj ? (
            <div>
              <div className="flex items-center justify-between">
                <div className={sectionLabel}>Rebuttals — Vote Your Favorite</div>
                {totalVotesForObjection(currentObj.id) > 0 && (
                  <div className={`text-[11px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                    {totalVotesForObjection(currentObj.id)} vote{totalVotesForObjection(currentObj.id) !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {currentObj.rebuttals.map((rb, idx) => {
                  const voteCount = votes[currentObj.id]?.[idx] ?? 0;
                  const isMyVote = userVotes[currentObj.id] === idx;
                  const isPending = votingId === `${currentObj.id}-${idx}`;
                  const total = totalVotesForObjection(currentObj.id);
                  const pct = total > 0 ? Math.round((voteCount / total) * 100) : 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleUseRebuttal(rb, idx)}
                      className={`relative overflow-hidden rounded-2xl border px-3 py-3 transition cursor-pointer hover:ring-2 hover:ring-amber-400/40 ${
                        isMyVote
                          ? isDarkMode
                            ? "border-sky-500/50 bg-sky-500/10"
                            : "border-sky-300 bg-sky-50"
                          : isDarkMode
                            ? "border-slate-800 bg-slate-900/60"
                            : "border-slate-100 bg-slate-50/80"
                      }`}
                    >
                      {total > 0 && (
                        <div
                          className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                            isMyVote
                                ? isDarkMode ? "bg-sky-500/10" : "bg-sky-100/50"
                                : isDarkMode ? "bg-slate-700/30" : "bg-slate-200/50"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-start gap-3">
                        <button
                          onClick={() => void handleVote(currentObj.id, idx)}
                          disabled={!!votingId}
                          title={isMyVote ? "Remove vote" : "Vote for this rebuttal"}
                          className={`mt-0.5 shrink-0 rounded-full p-1 transition ${
                            isMyVote
                              ? isDarkMode
                                ? "bg-sky-500/20 text-sky-300"
                                : "bg-sky-100 text-sky-600"
                              : isDarkMode
                                ? "text-slate-600 hover:bg-slate-800 hover:text-slate-300"
                                : "text-slate-300 hover:bg-white hover:text-slate-500"
                          } disabled:opacity-50`}
                        >
                          <ThumbsUp size={13} className={isPending ? "animate-pulse" : ""} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                            {rb}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleUseRebuttal(rb, idx); }}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition ${
                                copiedIdx === idx
                                  ? isDarkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                  : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                              {copiedIdx === idx ? "Copied!" : "Copy"}
                            </button>
                            {voteCount > 0 && (
                              <div className={`flex items-center gap-1 text-[11px] font-medium ${
                                isMyVote
                                  ? isDarkMode ? "text-sky-400" : "text-sky-600"
                                  : isDarkMode ? "text-slate-500" : "text-slate-400"
                              }`}>
                                <ThumbsUp size={10} />
                                {voteCount} vote{voteCount !== 1 ? "s" : ""}
                                {total > 0 && <span className="opacity-60">· {pct}%</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Submit an objection - reveal button */}
          <div>
            {!showSubmitForm ? (
              <button
                onClick={() => setShowSubmitForm(true)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  isDarkMode
                    ? "border-sky-500/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                    : "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                }`}
              >
                <Plus size={14} />
                Submit an Objection
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2">
                <div className={sectionLabel}>Submit an Objection</div>
                <textarea
                  value={submitText}
                  onChange={(e) => setSubmitText(e.target.value)}
                  rows={3}
                  placeholder="Describe the objection you've been hearing..."
                  className={`w-full ${inputCls}`}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!submitText.trim() || submitting}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      isDarkMode
                        ? "border-sky-500/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                        : "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                    }`}
                  >
                    <Send size={14} />
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSubmitForm(false); setSubmitText(""); }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isDarkMode
                        ? "border-slate-700 text-slate-400 hover:bg-slate-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Cancel
                  </button>
                </div>
                {submitted && (
                  <div className={`flex items-center gap-2 text-xs font-medium ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>
                    <Check size={14} />
                    Thanks! We'll review and add it to the list.
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ObjectionsDrawer;
