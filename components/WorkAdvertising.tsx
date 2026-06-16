import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ImageUp,
  Link as LinkIcon,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import type { AuthUser } from "../types";
import type {
  SocialAccount,
  SocialPlatform,
  SocialPostRecord,
} from "../services/socialApi";
import {
  cancelSocialPost,
  createSocialPost,
  deleteSocialPost,
  fetchSocialAccounts,
  fetchSocialPosts,
  publishSocialPostNow,
  scheduleSocialPost,
  updateSocialPost,
  uploadSocialAsset,
} from "../services/socialApi";
import {
  getSocialAccountReadiness,
  SOCIAL_PLATFORM_META_BY_ID,
  SOCIAL_PLATFORM_OPTIONS,
} from "./workAdvertising/socialPlatformGuidance";
import {
  buildSocialCalendarDays,
  getPostDateKey,
  makeDefaultScheduledLocal,
  toDateKey,
} from "./workAdvertising/socialCalendar";

type ComposerForm = {
  id: string | null;
  title: string;
  caption: string;
  scheduledForLocal: string;
  timezone: string;
  linkUrl: string;
  ctaLabel: string;
  googleTopicType: string;
  googleEventTitle: string;
  googleEventStartLocal: string;
  googleEventEndLocal: string;
  platforms: SocialPlatform[];
  platformAccountIds: Partial<Record<SocialPlatform, string>>;
  asset: {
    id: string;
    originalName: string;
    publicUrl: string;
    assetKind: string;
  } | null;
};

const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

const emptyForm = (): ComposerForm => ({
  id: null,
  title: "",
  caption: "",
  scheduledForLocal: "",
  timezone: localTimezone(),
  linkUrl: "",
  ctaLabel: "LEARN_MORE",
  googleTopicType: "STANDARD",
  googleEventTitle: "",
  googleEventStartLocal: "",
  googleEventEndLocal: "",
  platforms: ["facebook", "instagram"],
  platformAccountIds: {},
  asset: null,
});

const toLocalInputValue = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromLocalInputValue = (localValue: string) => {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatWhen = (iso: string | null | undefined) => {
  if (!iso) return "Not scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const formatDayTitle = (dateKey: string | null) => {
  if (!dateKey) return "Selected Day";
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
};

const postTitle = (post: SocialPostRecord) => post.title.trim() || post.caption.trim().slice(0, 40) || "Untitled post";

const defaultAccountIds = (accounts: SocialAccount[]) => {
  const out: Partial<Record<SocialPlatform, string>> = {};
  for (const platform of SOCIAL_PLATFORM_OPTIONS.map((item) => item.id)) {
    const preferred = accounts.find((item) => item.platform === platform && item.active) || accounts.find((item) => item.platform === platform);
    if (preferred?.id) out[platform] = preferred.id;
  }
  return out;
};

type WorkAdvertisingProps = {
  authUser: AuthUser;
  onOpenSocialIntegrations: () => void;
};

const WorkAdvertising: React.FC<WorkAdvertisingProps> = ({ authUser, onOpenSocialIntegrations }) => {
  const [posts, setPosts] = useState<SocialPostRecord[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [form, setForm] = useState<ComposerForm>(() => emptyForm());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = authUser.roles.includes("Owner");

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextPosts, nextAccounts] = await Promise.all([fetchSocialPosts(), fetchSocialAccounts()]);
      setPosts(nextPosts);
      setAccounts(nextAccounts);
      setForm((current) => ({
        ...current,
        platformAccountIds: {
          ...defaultAccountIds(nextAccounts),
          ...current.platformAccountIds,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load social calendar.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const calendarDays = useMemo(() => buildSocialCalendarDays(posts, visibleMonth), [posts, visibleMonth]);

  const selectedDayPosts = useMemo(() => {
    if (!selectedDayKey) return [];
    return posts
      .filter((post) => getPostDateKey(post) === selectedDayKey)
      .sort((a, b) => new Date(a.scheduledFor || a.createdAt).getTime() - new Date(b.scheduledFor || b.createdAt).getTime());
  }, [posts, selectedDayKey]);

  const summary = useMemo(() => ({
    total: posts.length,
    scheduled: posts.filter((post) => post.status === "scheduled").length,
    draft: posts.filter((post) => post.status === "draft").length,
    failed: posts.filter((post) => post.status === "failed").length,
  }), [posts]);

  const accountsByPlatform = useMemo(
    () => ({
      facebook: accounts.filter((item) => item.platform === "facebook"),
      instagram: accounts.filter((item) => item.platform === "instagram"),
      google: accounts.filter((item) => item.platform === "google"),
    }),
    [accounts]
  );

  const selectedAccountsByPlatform = useMemo(() => {
    return Object.fromEntries(
      SOCIAL_PLATFORM_OPTIONS.map((platform) => {
        const selectedAccountId = form.platformAccountIds[platform.id];
        const account =
          (selectedAccountId ? accounts.find((item) => item.id === selectedAccountId) : null) ||
          accounts.find((item) => item.platform === platform.id && item.active) ||
          null;
        return [platform.id, account];
      })
    ) as Record<SocialPlatform, SocialAccount | null>;
  }, [accounts, form.platformAccountIds]);

  const accountLabelById = useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.id,
          account.label || account.externalId || `${account.platform} connection`,
        ])
      ),
    [accounts]
  );

  const selectedPlatformStatus = useMemo(
    () =>
      form.platforms.map((platformId) => ({
        platform: platformId,
        label: SOCIAL_PLATFORM_META_BY_ID[platformId].label,
        docsUrl: SOCIAL_PLATFORM_META_BY_ID[platformId].docsUrl,
        account: selectedAccountsByPlatform[platformId],
        readiness: getSocialAccountReadiness(platformId, selectedAccountsByPlatform[platformId]),
      })),
    [form.platforms, selectedAccountsByPlatform]
  );

  const missingPlatformConnections = useMemo(
    () => selectedPlatformStatus.filter((item) => !item.readiness.ready).map((item) => item.platform),
    [selectedPlatformStatus]
  );

  const composerReadiness = useMemo(() => {
    const blocking: string[] = [];
    const warnings: string[] = [];
    const selectedPlatforms = new Set(form.platforms);

    if (!form.title.trim() && !form.caption.trim()) blocking.push("Add a title or caption before you schedule or publish.");
    if (!form.platforms.length) blocking.push("Choose at least one platform before you schedule or publish.");

    for (const status of selectedPlatformStatus) {
      for (const issue of status.readiness.issues) blocking.push(`${status.label}: ${issue}`);
      for (const warning of status.readiness.warnings) warnings.push(`${status.label}: ${warning}`);
    }

    if (selectedPlatforms.has("instagram")) {
      if (!form.asset) {
        blocking.push("Instagram requires an uploaded image or video asset.");
      } else if (form.asset.assetKind === "gif") {
        blocking.push("Instagram does not support direct GIF publishing here. Export it as MP4 or JPG first.");
      } else {
        warnings.push("Instagram will fetch the media from this server at publish time.");
      }
    }

    if (selectedPlatforms.has("google")) {
      if (form.asset && form.asset.assetKind !== "image") {
        blocking.push("Google Business Profile local posts only support image assets in this scheduler.");
      }
      if (form.googleTopicType === "EVENT" || form.googleTopicType === "OFFER") {
        const start = fromLocalInputValue(form.googleEventStartLocal);
        const end = fromLocalInputValue(form.googleEventEndLocal);
        if (!start || !end) {
          blocking.push(`Google ${form.googleTopicType.toLowerCase()} posts need both a start and end time.`);
        } else if (new Date(start).getTime() >= new Date(end).getTime()) {
          blocking.push("Google event timing is invalid. End time must be after the start time.");
        }
      }
    }

    if (selectedPlatforms.has("facebook") && form.asset?.assetKind === "video") {
      warnings.push("Facebook video publishing still depends on the publish_video permission on the saved Page token.");
    }

    return { blocking, warnings };
  }, [
    form.asset,
    form.caption,
    form.googleEventEndLocal,
    form.googleEventStartLocal,
    form.googleTopicType,
    form.platforms,
    form.title,
    selectedPlatformStatus,
  ]);

  const setField = <K extends keyof ComposerForm>(key: K, value: ComposerForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const replacePostInState = (next: SocialPostRecord | null) => {
    if (!next) return;
    setPosts((current) => {
      const exists = current.some((item) => item.id === next.id);
      const updated = exists ? current.map((item) => (item.id === next.id ? next : item)) : [next, ...current];
      return [...updated].sort((a, b) => {
        const aTime = new Date(a.scheduledFor || a.createdAt).getTime();
        const bTime = new Date(b.scheduledFor || b.createdAt).getTime();
        return bTime - aTime;
      });
    });
  };

  const openDay = (dateKey: string) => {
    setSelectedDayKey(dateKey);
    setShowComposer(false);
    setShowAdvanced(false);
    setMessage(null);
    setError(null);
  };

  const startNewDraft = (dateKey = selectedDayKey || toDateKey(new Date())) => {
    setSelectedDayKey(dateKey);
    setForm({
      ...emptyForm(),
      scheduledForLocal: makeDefaultScheduledLocal(dateKey),
      platformAccountIds: defaultAccountIds(accounts),
    });
    setShowComposer(true);
    setShowAdvanced(false);
    setMessage(null);
    setError(null);
  };

  const loadPostIntoComposer = (post: SocialPostRecord) => {
    setSelectedDayKey(getPostDateKey(post));
    setMessage(null);
    setError(null);
    setForm({
      id: post.id,
      title: post.title,
      caption: post.caption,
      scheduledForLocal: toLocalInputValue(post.scheduledFor),
      timezone: post.timezone || localTimezone(),
      linkUrl: post.linkUrl || "",
      ctaLabel: post.ctaLabel || "LEARN_MORE",
      googleTopicType: post.googleTopicType || "STANDARD",
      googleEventTitle: post.googleEventTitle || "",
      googleEventStartLocal: toLocalInputValue(post.googleEventStart),
      googleEventEndLocal: toLocalInputValue(post.googleEventEnd),
      platforms: post.platforms.length ? post.platforms : ["facebook"],
      platformAccountIds: post.platformAccountIds || defaultAccountIds(accounts),
      asset: post.asset
        ? {
            id: post.asset.id,
            originalName: post.asset.originalName,
            publicUrl: post.asset.publicUrl,
            assetKind: post.asset.assetKind,
          }
        : null,
    });
    setShowComposer(true);
    setShowAdvanced(Boolean(post.linkUrl || post.googleTopicType !== "STANDARD" || post.googleEventTitle));
  };

  const makePayload = (status: "draft" = "draft") => ({
    title: form.title,
    caption: form.caption,
    status,
    scheduledFor: fromLocalInputValue(form.scheduledForLocal),
    timezone: form.timezone,
    linkUrl: form.linkUrl,
    ctaLabel: form.ctaLabel,
    googleTopicType: form.googleTopicType,
    googleEventTitle: form.googleEventTitle,
    googleEventStart: fromLocalInputValue(form.googleEventStartLocal),
    googleEventEnd: fromLocalInputValue(form.googleEventEndLocal),
    platforms: form.platforms,
    platformAccountIds: form.platformAccountIds,
    assetId: form.asset?.id || null,
  });

  const saveDraft = async () => {
    setBusyKey("save");
    setError(null);
    setMessage(null);
    try {
      const next = form.id ? await updateSocialPost(form.id, makePayload()) : await createSocialPost(makePayload());
      replacePostInState(next);
      if (next) loadPostIntoComposer(next);
      setMessage("Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save draft.");
    } finally {
      setBusyKey(null);
    }
  };

  const schedulePost = async () => {
    setBusyKey("schedule");
    setError(null);
    setMessage(null);
    try {
      if (composerReadiness.blocking.length) throw new Error(composerReadiness.blocking[0]);
      const scheduledFor = fromLocalInputValue(form.scheduledForLocal);
      if (!scheduledFor) throw new Error("Choose a schedule date and time first.");
      const draft = form.id ? await updateSocialPost(form.id, makePayload()) : await createSocialPost(makePayload());
      if (!draft) throw new Error("Unable to stage draft for scheduling.");
      const next = await scheduleSocialPost(draft.id, {
        scheduledFor,
        platforms: form.platforms,
        platformAccountIds: form.platformAccountIds,
      });
      replacePostInState(next);
      if (next) loadPostIntoComposer(next);
      setMessage("Post scheduled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to schedule post.");
    } finally {
      setBusyKey(null);
    }
  };

  const publishNow = async () => {
    setBusyKey("publish");
    setError(null);
    setMessage(null);
    try {
      if (composerReadiness.blocking.length) throw new Error(composerReadiness.blocking[0]);
      const draft = form.id ? await updateSocialPost(form.id, makePayload()) : await createSocialPost(makePayload());
      if (!draft) throw new Error("Unable to stage post for publishing.");
      const next = await publishSocialPostNow(draft.id, {
        platforms: form.platforms,
        platformAccountIds: form.platformAccountIds,
      });
      replacePostInState(next);
      if (next) loadPostIntoComposer(next);
      setMessage("Publish started. Provider results will show on this day.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish now.");
    } finally {
      setBusyKey(null);
    }
  };

  const uploadAsset = async (file: File | null) => {
    if (!file) return;
    setBusyKey("asset");
    setError(null);
    setMessage(null);
    try {
      const asset = await uploadSocialAsset(file);
      if (!asset) throw new Error("Asset upload did not return a stored file.");
      setForm((current) => ({
        ...current,
        asset: {
          id: asset.id,
          originalName: asset.originalName,
          publicUrl: asset.publicUrl,
          assetKind: asset.assetKind,
        },
      }));
      setMessage(`Stored ${asset.originalName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload asset.");
    } finally {
      setBusyKey(null);
    }
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setForm((current) => {
      const exists = current.platforms.includes(platform);
      const nextPlatforms = exists ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform];
      const nextPlatformAccountIds = { ...current.platformAccountIds };
      if (!exists && !nextPlatformAccountIds[platform]) {
        const preferred = accounts.find((item) => item.platform === platform && item.active) || accounts.find((item) => item.platform === platform);
        if (preferred?.id) nextPlatformAccountIds[platform] = preferred.id;
      }
      return { ...current, platforms: nextPlatforms, platformAccountIds: nextPlatformAccountIds };
    });
  };

  const cancelPost = async (post: SocialPostRecord) => {
    setBusyKey(`cancel-${post.id}`);
    setError(null);
    setMessage(null);
    try {
      const next = await cancelSocialPost(post.id);
      replacePostInState(next);
      if (form.id === post.id && next) loadPostIntoComposer(next);
      setMessage("Scheduled publish cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel schedule.");
    } finally {
      setBusyKey(null);
    }
  };

  const publishExistingPost = async (post: SocialPostRecord) => {
    setBusyKey(`publish-${post.id}`);
    setError(null);
    setMessage(null);
    try {
      const next = await publishSocialPostNow(post.id, {
        platforms: post.platforms,
        platformAccountIds: post.platformAccountIds,
      });
      replacePostInState(next);
      if (form.id === post.id && next) loadPostIntoComposer(next);
      setMessage("Publish started. Check the job badges for live status.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish post.");
    } finally {
      setBusyKey(null);
    }
  };

  const removePost = async (post: SocialPostRecord) => {
    const label = postTitle(post);
    if (!window.confirm(`Delete "${label}"? This removes the draft and queued publish jobs.`)) return;
    setBusyKey(`delete-${post.id}`);
    setError(null);
    setMessage(null);
    try {
      await deleteSocialPost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      if (form.id === post.id) {
        setShowComposer(false);
        setForm({ ...emptyForm(), platformAccountIds: defaultAccountIds(accounts) });
      }
      setMessage("Post deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete post.");
    } finally {
      setBusyKey(null);
    }
  };

  const shiftMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const openTodayDraft = () => {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    startNewDraft(toDateKey(today));
  };

  return (
    <div className="h-full overflow-auto bg-slate-50/60 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">A.I. Marketing + Promotions</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Social calendar</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Click a day to add, edit, publish, cancel, or delete posts from one focused popup.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOwner && missingPlatformConnections.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenSocialIntegrations}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
                >
                  <AlertTriangle size={15} /> Configure social
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadWorkspace()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <RefreshCcw size={15} /> Refresh
              </button>
              <button
                type="button"
                onClick={openTodayDraft}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus size={15} /> New Post
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{summary.total} total</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{summary.scheduled} scheduled</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{summary.draft} drafts</span>
            {summary.failed > 0 && <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">{summary.failed} failed</span>}
          </div>
        </section>

        {(message || error) && (
          <section className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {error || message}
          </section>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-slate-500" />
              <div>
                <h3 className="text-lg font-semibold text-slate-950">{formatMonthTitle(visibleMonth)}</h3>
                <p className="text-xs text-slate-500">Each box is a day. Badges show what is planned.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setVisibleMonth(new Date())}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading social calendar...</div>
          ) : (
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-7 gap-2 pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day) => (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => openDay(day.dateKey)}
                    aria-label={`Open ${day.dateKey}: ${day.counts.total} ${day.counts.total === 1 ? "post" : "posts"}`}
                    className={`min-h-[104px] rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                      day.isToday
                        ? "border-slate-950 bg-slate-950 text-white"
                        : day.inCurrentMonth
                          ? "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                          : "border-slate-100 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{day.dayNumber}</span>
                      {day.counts.total > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${day.isToday ? "bg-white/20 text-white" : "bg-slate-900 text-white"}`}>
                          {day.counts.total}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {day.posts.slice(0, 2).map((post) => (
                        <div key={post.id} className={`truncate rounded-lg px-2 py-1 text-[11px] font-semibold ${day.isToday ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>
                          {postTitle(post)}
                        </div>
                      ))}
                      {day.posts.length > 2 && (
                        <div className={`px-2 text-[11px] font-semibold ${day.isToday ? "text-white/80" : "text-slate-500"}`}>
                          +{day.posts.length - 2} more
                        </div>
                      )}
                    </div>
                    {day.counts.total > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {day.counts.scheduled > 0 && <span className="h-2 w-2 rounded-full bg-blue-500" title="Scheduled" />}
                        {day.counts.draft > 0 && <span className="h-2 w-2 rounded-full bg-slate-400" title="Draft" />}
                        {day.counts.published > 0 && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Published" />}
                        {day.counts.failed > 0 && <span className="h-2 w-2 rounded-full bg-rose-500" title="Failed" />}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedDayKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="social-day-dialog-title"
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Day popup</div>
                <h3 id="social-day-dialog-title" className="mt-1 text-2xl font-semibold text-slate-950">
                  {formatDayTitle(selectedDayKey)} Posts
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startNewDraft(selectedDayKey)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus size={15} /> Add Post
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDayKey(null)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  <X size={15} /> Close
                </button>
              </div>
            </div>

            {(message || error) && (
              <div className={`mx-4 mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                {error || message}
              </div>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[380px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-950">Posts for this day</h4>
                    <p className="text-xs text-slate-500">{selectedDayPosts.length} item{selectedDayPosts.length === 1 ? "" : "s"}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedDayPosts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                      Nothing planned yet. Add the first post for this day.
                    </div>
                  ) : (
                    selectedDayPosts.map((post) => (
                      <article key={post.id} className={`rounded-2xl border p-4 ${form.id === post.id ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">{post.status}</span>
                              {post.platforms.map((platform) => (
                                <span key={`${post.id}-${platform}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  {SOCIAL_PLATFORM_OPTIONS.find((item) => item.id === platform)?.label || platform}
                                </span>
                              ))}
                            </div>
                            <h5 className="mt-3 font-semibold text-slate-950">{postTitle(post)}</h5>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.caption || "No caption yet."}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>Scheduled: {formatWhen(post.scheduledFor)}</span>
                          {post.asset && <span>Asset: {post.asset.originalName}</span>}
                        </div>
                        {post.platforms.some((platform) => post.platformAccountIds?.[platform]) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {post.platforms.map((platform) => {
                              const accountId = post.platformAccountIds?.[platform];
                              if (!accountId) return null;
                              return (
                                <span key={`${post.id}-${platform}-account`} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                  {accountLabelById.get(accountId) || `Account ${accountId}`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {post.lastError && (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            {post.lastError}
                          </div>
                        )}
                        {post.jobs.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {post.jobs.slice(0, 4).map((job) => (
                              <span key={job.id} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                                {job.platform}: {job.status}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => loadPostIntoComposer(post)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void publishExistingPost(post)}
                            disabled={busyKey === `publish-${post.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            <CheckCircle2 size={13} /> Publish
                          </button>
                          {post.status === "scheduled" && (
                            <button
                              type="button"
                              onClick={() => void cancelPost(post)}
                              disabled={busyKey === `cancel-${post.id}`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                            >
                              <XCircle size={13} /> Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Delete ${postTitle(post)}`}
                            onClick={() => void removePost(post)}
                            disabled={busyKey === `delete-${post.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </aside>

              <main className="min-h-0 p-4">
                {!showComposer ? (
                  <div className="flex h-full min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div>
                      <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
                      <h4 className="mt-3 text-lg font-semibold text-slate-950">Add or edit from this popup</h4>
                      <p className="mt-2 max-w-md text-sm text-slate-600">
                        Pick an existing post on the left or create a new draft for {formatDayTitle(selectedDayKey)}.
                      </p>
                      <button
                        type="button"
                        onClick={() => startNewDraft(selectedDayKey)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                      >
                        <Plus size={15} /> Add Post
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Composer</div>
                        <h4 className="text-xl font-semibold text-slate-950">{form.id ? "Edit Post" : "New Post"}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowComposer(false)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Hide Composer
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Title</div>
                        <input
                          type="text"
                          value={form.title}
                          onChange={(event) => setField("title", event.target.value)}
                          placeholder="Weekend sofa promo"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</div>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <CalendarClock size={15} className="text-slate-400" />
                          <input
                            type="datetime-local"
                            value={form.scheduledForLocal}
                            onChange={(event) => setField("scheduledForLocal", event.target.value)}
                            className="w-full bg-transparent text-sm outline-none"
                          />
                        </div>
                      </label>
                    </div>

                    <label className="mt-4 block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Caption / Copy</div>
                      <textarea
                        value={form.caption}
                        onChange={(event) => setField("caption", event.target.value)}
                        placeholder="Paste your caption here..."
                        rows={6}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                      />
                    </label>

                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Platforms</div>
                      <div className="flex flex-wrap gap-2">
                        {SOCIAL_PLATFORM_OPTIONS.map((platform) => {
                          const selected = form.platforms.includes(platform.id);
                          return (
                            <button
                              key={platform.id}
                              type="button"
                              onClick={() => togglePlatform(platform.id)}
                              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                selected ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {platform.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!!form.platforms.length && (
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {form.platforms.map((platformId) => {
                          const platform = SOCIAL_PLATFORM_OPTIONS.find((item) => item.id === platformId);
                          const options = accountsByPlatform[platformId];
                          return (
                            <label key={platformId} className="block">
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {platform?.label || platformId}
                              </div>
                              <select
                                value={form.platformAccountIds[platformId] || ""}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    platformAccountIds: {
                                      ...current.platformAccountIds,
                                      [platformId]: event.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                              >
                                <option value="">
                                  {platformId === "google" ? "Choose Google account / location" : `Choose ${platform?.label || platformId} account`}
                                </option>
                                {options.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.label || account.externalId || `${platform?.label || platformId} connection`}
                                    {account.active ? "" : " (inactive)"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Media Asset</div>
                          {form.asset ? (
                            <div className="mt-1 text-sm font-semibold text-slate-900">{form.asset.originalName}</div>
                          ) : (
                            <div className="mt-1 text-sm text-slate-500">No image or video linked yet.</div>
                          )}
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                          <ImageUp size={15} /> {busyKey === "asset" ? "Uploading..." : "Upload Asset"}
                          <input
                            type="file"
                            accept="image/*,video/*,.gif"
                            className="hidden"
                            onChange={(event) => void uploadAsset(event.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdvanced((current) => !current)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      <Settings2 size={15} /> {showAdvanced ? "Hide" : "Show"} link, Google, and readiness options
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <label className="block xl:col-span-2">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Link URL</div>
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <LinkIcon size={15} className="text-slate-400" />
                              <input
                                type="url"
                                value={form.linkUrl}
                                onChange={(event) => setField("linkUrl", event.target.value)}
                                placeholder="https://..."
                                className="w-full bg-transparent text-sm outline-none"
                              />
                            </div>
                          </label>
                          <label className="block">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Google CTA</div>
                            <select
                              value={form.ctaLabel}
                              onChange={(event) => setField("ctaLabel", event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                            >
                              <option value="LEARN_MORE">Learn More</option>
                              <option value="SHOP">Shop</option>
                              <option value="BOOK">Book</option>
                              <option value="ORDER">Order</option>
                              <option value="SIGN_UP">Sign Up</option>
                              <option value="CALL">Call</option>
                            </select>
                          </label>
                          <label className="block">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Google Type</div>
                            <select
                              value={form.googleTopicType}
                              onChange={(event) => setField("googleTopicType", event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                            >
                              <option value="STANDARD">Standard</option>
                              <option value="EVENT">Event</option>
                              <option value="OFFER">Offer</option>
                              <option value="ALERT">Alert</option>
                            </select>
                          </label>
                        </div>

                        {(form.googleTopicType === "EVENT" || form.googleTopicType === "OFFER") && (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <label className="block">
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Event Title</div>
                              <input
                                type="text"
                                value={form.googleEventTitle}
                                onChange={(event) => setField("googleEventTitle", event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                              />
                            </label>
                            <label className="block">
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Event Start</div>
                              <input
                                type="datetime-local"
                                value={form.googleEventStartLocal}
                                onChange={(event) => setField("googleEventStartLocal", event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                              />
                            </label>
                            <label className="block">
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Event End</div>
                              <input
                                type="datetime-local"
                                value={form.googleEventEndLocal}
                                onChange={(event) => setField("googleEventEndLocal", event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                              />
                            </label>
                          </div>
                        )}

                        <label className="block max-w-md">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</div>
                          <input
                            type="text"
                            value={form.timezone}
                            onChange={(event) => setField("timezone", event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <div className="space-y-2">
                          {composerReadiness.blocking.length > 0 && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                              {composerReadiness.blocking.map((issue) => <div key={`blocking-${issue}`}>{issue}</div>)}
                            </div>
                          )}
                          {composerReadiness.warnings.length > 0 && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                              {composerReadiness.warnings.map((warning) => <div key={`warning-${warning}`}>{warning}</div>)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void saveDraft()}
                        disabled={busyKey !== null}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                      >
                        <Save size={15} /> Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => void schedulePost()}
                        disabled={busyKey !== null || composerReadiness.blocking.length > 0}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        <Clock3 size={15} /> Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => void publishNow()}
                        disabled={busyKey !== null || composerReadiness.blocking.length > 0}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        <Send size={15} /> Publish Now
                      </button>
                      {form.id && (
                        <button
                          type="button"
                          aria-label={`Delete ${form.title || "current post"}`}
                          onClick={() => {
                            const current = posts.find((post) => post.id === form.id);
                            if (current) void removePost(current);
                          }}
                          disabled={busyKey !== null}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </main>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default WorkAdvertising;
