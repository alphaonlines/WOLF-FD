import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Hash,
  Lock,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Forward,
  X,
} from "lucide-react";
import { useBotBotContext } from "./botbot/BotBotContext";
import type { AuthUser, BoardMessage, BoardUpload, BoardUser } from "../types";
import { checkPosBackendHealthy } from "../services/posBackendApi";
import {
  createBoardMessage,
  deleteBoardMessage,
  fetchBoardChannels,
  fetchBoardMessages,
  fetchBoardUsers,
  forwardBoardMessage,
  type BoardChannel,
  updateBoardMessage,
  uploadBoardAttachment,
} from "../services/messageBoardApi";

type SyncMode = "POS_DB" | "LOCAL_STORAGE";
type ViewMode = "channel" | "dm";

type MessageBoardProps = {
  authUser: AuthUser;
  onMessageSent?: (info: { author: string; body: string; channel: string | null }) => void;
};

const LOCAL_CHANNELS: BoardChannel[] = [
  { id: "announcements", name: "announcements", isPrivate: false, count: 2 },
  { id: "sales-floor", name: "sales-floor", isPrivate: false, count: 1 },
  { id: "operations", name: "operations", isPrivate: false, count: 1 },
  { id: "inventory", name: "inventory", isPrivate: false, count: 0 },
  { id: "marketing", name: "marketing", isPrivate: false, count: 0 },
  { id: "leadership", name: "leadership", isPrivate: true, count: 1 },
];

const LOCAL_USERS: BoardUser[] = [
  {
    id: "2",
    name: "Store Ops",
    email: "ops@furnituredistributors.wolf.discount",
    roles: ["Manager"],
    active: true,
    lastMessageAt: "2026-03-10T13:40:00.000Z",
    lastMessagePreview: "Let me know when the front tables are reset.",
  },
  {
    id: "3",
    name: "Front Desk",
    email: "frontdesk@furnituredistributors.wolf.discount",
    roles: ["Sales"],
    active: true,
    lastMessageAt: "2026-03-10T14:05:00.000Z",
    lastMessagePreview: "Customer waiting at the mattress gallery.",
  },
];

const LOCAL_MESSAGES: Record<string, BoardMessage[]> = {
  "channel:announcements": [
    {
      id: "local-1",
      scope: "channel",
      channel: "announcements",
      body: "Showroom reset starts at 9:30 AM. Please confirm your section is ready before open.",
      priority: true,
      authorName: "Store Ops",
      authorEmail: "ops@furnituredistributors.wolf.discount",
      authorUserId: "2",
      recipientUserId: null,
      recipientName: "",
      recipientEmail: "",
      attachment: null,
      mentions: [],
      editedAt: null,
      deletedAt: null,
      forwardedFromMessageId: null,
      createdAt: "2026-03-10T13:10:00.000Z",
      updatedAt: "2026-03-10T13:10:00.000Z",
    },
    {
      id: "local-2",
      scope: "channel",
      channel: "announcements",
      body: "Follow-up calls are due by 2 PM. Keep next-action notes updated in CRM.",
      priority: false,
      authorName: "Sales Lead",
      authorEmail: "sales@furnituredistributors.wolf.discount",
      authorUserId: "4",
      recipientUserId: null,
      recipientName: "",
      recipientEmail: "",
      attachment: null,
      mentions: [],
      editedAt: null,
      deletedAt: null,
      forwardedFromMessageId: null,
      createdAt: "2026-03-10T14:30:00.000Z",
      updatedAt: "2026-03-10T14:30:00.000Z",
    },
  ],
  "channel:sales-floor": [
    {
      id: "local-3",
      scope: "channel",
      channel: "sales-floor",
      body: "Two walk-ins waiting for mattress help at FD5. @frontdesk has them seated.",
      priority: false,
      authorName: "Front Desk",
      authorEmail: "frontdesk@furnituredistributors.wolf.discount",
      authorUserId: "3",
      recipientUserId: null,
      recipientName: "",
      recipientEmail: "",
      attachment: null,
      mentions: ["frontdesk"],
      editedAt: null,
      deletedAt: null,
      forwardedFromMessageId: null,
      createdAt: "2026-03-10T15:05:00.000Z",
      updatedAt: "2026-03-10T15:05:00.000Z",
    },
  ],
  "channel:operations": [
    {
      id: "local-4",
      scope: "channel",
      channel: "operations",
      body: "Truck #2 loading moved to 4:00 PM due to route adjustment.",
      priority: false,
      authorName: "Dispatch",
      authorEmail: "dispatch@furnituredistributors.wolf.discount",
      authorUserId: "5",
      recipientUserId: null,
      recipientName: "",
      recipientEmail: "",
      attachment: null,
      mentions: [],
      editedAt: null,
      deletedAt: null,
      forwardedFromMessageId: null,
      createdAt: "2026-03-10T16:20:00.000Z",
      updatedAt: "2026-03-10T16:20:00.000Z",
    },
  ],
  "channel:leadership": [
    {
      id: "local-5",
      scope: "channel",
      channel: "leadership",
      body: "Weekly KPI review moved to Friday at 8:15 AM.",
      priority: false,
      authorName: "Owner",
      authorEmail: "owner@furnituredistributors.wolf.discount",
      authorUserId: "1",
      recipientUserId: null,
      recipientName: "",
      recipientEmail: "",
      attachment: null,
      mentions: [],
      editedAt: null,
      deletedAt: null,
      forwardedFromMessageId: null,
      createdAt: "2026-03-10T12:00:00.000Z",
      updatedAt: "2026-03-10T12:00:00.000Z",
    },
  ],
  "dm:2": [
    {
      id: "local-dm-1",
      scope: "dm",
      channel: null,
      body: "Let me know when the front tables are reset.",
      priority: false,
      authorName: "Store Ops",
      authorEmail: "ops@furnituredistributors.wolf.discount",
      authorUserId: "2",
      recipientUserId: "1",
      recipientName: "Owner",
      recipientEmail: "owner@furnituredistributors.wolf.discount",
      attachment: null,
      mentions: [],
      editedAt: null,
      deletedAt: null,
      forwardedFromMessageId: null,
      createdAt: "2026-03-10T13:40:00.000Z",
      updatedAt: "2026-03-10T13:40:00.000Z",
    },
  ],
  "dm:3": [
    {
      id: "local-dm-2",
      scope: "dm",
      channel: null,
      body: "Customer waiting at the mattress gallery.",
      priority: false,
      authorName: "Front Desk",
      authorEmail: "frontdesk@furnituredistributors.wolf.discount",
      authorUserId: "3",
      recipientUserId: "1",
      recipientName: "Owner",
      recipientEmail: "owner@furnituredistributors.wolf.discount",
      attachment: null,
      mentions: [],
      editedAt: null,
      deletedAt: null,
      forwardedFromMessageId: null,
      createdAt: "2026-03-10T14:05:00.000Z",
      updatedAt: "2026-03-10T14:05:00.000Z",
    },
  ],
};

const formatStamp = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const keyForView = (mode: ViewMode, targetId: string) => `${mode}:${targetId}`;

const fileSizeLabel = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const renderMessageBody = (body: string) => {
  const parts = body.split(/(@[a-z0-9._-]+)/gi);
  return parts.map((part, index) =>
    /^@[a-z0-9._-]+$/i.test(part) ? (
      <span key={`${part}-${index}`} className="font-semibold text-sky-300">
        {part}
      </span>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
};

const MessageBoard: React.FC<MessageBoardProps> = ({ authUser, onMessageSent }) => {
  const { setPageContext } = useBotBotContext();
  const isLeadershipUser = authUser.roles.includes("Owner") || authUser.roles.includes("Manager");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const visibleLocalChannels = useMemo(
    () => LOCAL_CHANNELS.filter((channel) => !channel.isPrivate || isLeadershipUser),
    [isLeadershipUser]
  );

  const [syncMode, setSyncMode] = useState<SyncMode>("LOCAL_STORAGE");
  const [channels, setChannels] = useState<BoardChannel[]>(visibleLocalChannels);
  const [users, setUsers] = useState<BoardUser[]>(LOCAL_USERS);
  const [viewMode, setViewMode] = useState<ViewMode>("channel");
  const [activeTargetId, setActiveTargetId] = useState<string>(visibleLocalChannels[0]?.id || "announcements");
  const [messagesByView, setMessagesByView] = useState<Record<string, BoardMessage[]>>(LOCAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<{ file: File | null; upload: BoardUpload | null }>({
    file: null,
    upload: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [forwardScope, setForwardScope] = useState<ViewMode>("channel");
  const [forwardTargetId, setForwardTargetId] = useState<string>(visibleLocalChannels[0]?.id || "announcements");

  const conversationKey = keyForView(viewMode, activeTargetId);
  const messages = messagesByView[conversationKey] || [];
  const activeChannel = channels.find((channel) => channel.id === activeTargetId) || null;
  const activeUser = users.find((user) => user.id === activeTargetId) || null;

  useEffect(() => {
    setPageContext({
      pageName: "Message Board",
      module: "board",
      userRole: "Employee",
      keyMetricsVisible: [],
      suggestedActions: [],
    });
  }, [setPageContext]);

  useEffect(() => {
    if (!channels.some((channel) => channel.id === activeTargetId) && viewMode === "channel") {
      setActiveTargetId(channels[0]?.id || "announcements");
    }
  }, [channels, activeTargetId, viewMode]);

  useEffect(() => {
    if (!users.some((user) => user.id === activeTargetId) && viewMode === "dm" && users.length) {
      setActiveTargetId(users[0].id);
    }
  }, [users, activeTargetId, viewMode]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [conversationKey, messages.length]);

  useEffect(() => {
    let stopped = false;
    let pollId: number | null = null;

    const loadLocal = () => {
      if (stopped) return;
      setSyncMode("LOCAL_STORAGE");
      setChannels(visibleLocalChannels);
      setUsers(LOCAL_USERS);
      setMessagesByView((current) => ({ ...LOCAL_MESSAGES, ...current }));
    };

    const refreshLists = async () => {
      const [nextChannels, nextUsers] = await Promise.all([fetchBoardChannels(), fetchBoardUsers()]);
      if (stopped) return;
      setChannels(nextChannels.filter((channel) => !channel.isPrivate || isLeadershipUser));
      setUsers(nextUsers);
    };

    const startSync = async () => {
      try {
        const healthy = await checkPosBackendHealthy();
        if (!healthy) {
          loadLocal();
          return;
        }
        setSyncMode("POS_DB");
        await refreshLists();
        if (stopped) return;
        pollId = window.setInterval(() => {
          void refreshLists().catch(() => {
            if (!stopped) setSyncMode("LOCAL_STORAGE");
          });
        }, 5000);
      } catch {
        loadLocal();
      }
    };

    void startSync();

    return () => {
      stopped = true;
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, [isLeadershipUser, visibleLocalChannels]);

  useEffect(() => {
    let stopped = false;
    const loadMessages = async () => {
      if (syncMode === "LOCAL_STORAGE") return;
      try {
        const rows =
          viewMode === "channel"
            ? await fetchBoardMessages({ scope: "channel", channel: activeTargetId })
            : await fetchBoardMessages({ scope: "dm", userId: activeTargetId });
        if (stopped) return;
        setMessagesByView((current) => ({ ...current, [conversationKey]: rows }));
      } catch (err) {
        if (stopped) return;
        console.warn("Failed to load board messages from API, switching to local fallback:", err);
        setSyncMode("LOCAL_STORAGE");
      }
    };

    void loadMessages();
    return () => {
      stopped = true;
    };
  }, [syncMode, viewMode, activeTargetId, conversationKey]);

  const selectChannel = (channelId: string) => {
    setViewMode("channel");
    setActiveTargetId(channelId);
    setForwardScope("channel");
    setForwardTargetId(channelId);
    setError(null);
  };

  const selectDm = (userId: string) => {
    setViewMode("dm");
    setActiveTargetId(userId);
    setForwardScope("dm");
    setForwardTargetId(userId);
    setError(null);
  };

  const refreshCurrentConversation = async () => {
    if (syncMode !== "POS_DB") return;
    const next =
      viewMode === "channel"
        ? await fetchBoardMessages({ scope: "channel", channel: activeTargetId })
        : await fetchBoardMessages({ scope: "dm", userId: activeTargetId });
    setMessagesByView((current) => ({ ...current, [conversationKey]: next }));
  };

  const updateLocalConversation = (updater: (current: BoardMessage[]) => BoardMessage[]) => {
    setMessagesByView((current) => ({
      ...current,
      [conversationKey]: updater(current[conversationKey] || []),
    }));
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || busy) return;

    setBusy(true);
    setError(null);

    try {
      if (syncMode === "LOCAL_STORAGE") {
        const attachment =
          selectedAttachment.file && !selectedAttachment.upload
            ? {
                id: `local-upload-${Date.now()}`,
                originalName: selectedAttachment.file.name,
                mimeType: selectedAttachment.file.type || "application/octet-stream",
                fileSizeBytes: selectedAttachment.file.size,
                publicUrl: URL.createObjectURL(selectedAttachment.file),
                createdAt: new Date().toISOString(),
              }
            : selectedAttachment.upload;

        const localMessage: BoardMessage = {
          id: `local-message-${Date.now()}`,
          scope: viewMode,
          channel: viewMode === "channel" ? activeTargetId : null,
          body,
          priority: viewMode === "channel" ? priorityDraft : false,
          authorName: authUser.name || authUser.email,
          authorEmail: authUser.email,
          authorUserId: authUser.id,
          recipientUserId: viewMode === "dm" ? activeTargetId : null,
          recipientName: activeUser?.name || "",
          recipientEmail: activeUser?.email || "",
          attachment: attachment || null,
          mentions: Array.from(new Set((body.match(/@(?:[a-z0-9._-]+)/gi) || []).map((token) => token.slice(1).toLowerCase()))),
          editedAt: null,
          deletedAt: null,
          forwardedFromMessageId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updateLocalConversation((current) => [...current, localMessage]);
      } else {
        let attachmentUploadId: string | null = null;
        if (selectedAttachment.file && !selectedAttachment.upload) {
          const uploaded = await uploadBoardAttachment(selectedAttachment.file);
          attachmentUploadId = uploaded.id;
        } else if (selectedAttachment.upload) {
          attachmentUploadId = selectedAttachment.upload.id;
        }

        await createBoardMessage({
          scope: viewMode,
          channel: viewMode === "channel" ? activeTargetId : undefined,
          recipientUserId: viewMode === "dm" ? activeTargetId : undefined,
          body,
          priority: viewMode === "channel" ? priorityDraft : false,
          attachmentUploadId,
        });
        await refreshCurrentConversation();
        const [nextChannels, nextUsers] = await Promise.all([fetchBoardChannels(), fetchBoardUsers()]);
        setChannels(nextChannels.filter((channel) => !channel.isPrivate || isLeadershipUser));
        setUsers(nextUsers);
      }

      onMessageSent?.({
        author: authUser.name || authUser.email,
        body,
        channel: viewMode === "channel" ? activeTargetId : null,
      });
      setDraft("");
      setPriorityDraft(false);
      setSelectedAttachment({ file: null, upload: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setBusy(false);
    }
  };

  const handleStartEdit = (message: BoardMessage) => {
    setEditingMessageId(message.id);
    setEditingBody(message.body);
    setForwardMessageId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (syncMode === "LOCAL_STORAGE") {
        updateLocalConversation((current) =>
          current.map((message) =>
            message.id === editingMessageId
              ? {
                  ...message,
                  body: editingBody.trim(),
                  editedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : message
          )
        );
      } else {
        await updateBoardMessage(editingMessageId, { body: editingBody.trim() });
        await refreshCurrentConversation();
      }
      setEditingMessageId(null);
      setEditingBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update message.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    setBusy(true);
    setError(null);
    try {
      if (syncMode === "LOCAL_STORAGE") {
        updateLocalConversation((current) => current.filter((message) => message.id !== messageId));
      } else {
        await deleteBoardMessage(messageId);
        await refreshCurrentConversation();
        const [nextChannels, nextUsers] = await Promise.all([fetchBoardChannels(), fetchBoardUsers()]);
        setChannels(nextChannels.filter((channel) => !channel.isPrivate || isLeadershipUser));
        setUsers(nextUsers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete message.");
    } finally {
      setBusy(false);
    }
  };

  const handleForward = async () => {
    if (!forwardMessageId || !forwardTargetId) return;
    setBusy(true);
    setError(null);
    try {
      if (syncMode === "LOCAL_STORAGE") {
        const source = messages.find((message) => message.id === forwardMessageId);
        if (!source) throw new Error("Message not found.");
        const forwardKey = keyForView(forwardScope, forwardTargetId);
        const forwarded: BoardMessage = {
          ...source,
          id: `local-forward-${Date.now()}`,
          scope: forwardScope,
          channel: forwardScope === "channel" ? forwardTargetId : null,
          recipientUserId: forwardScope === "dm" ? forwardTargetId : null,
          recipientName: forwardScope === "dm" ? users.find((user) => user.id === forwardTargetId)?.name || "" : "",
          recipientEmail: forwardScope === "dm" ? users.find((user) => user.id === forwardTargetId)?.email || "" : "",
          authorName: authUser.name || authUser.email,
          authorEmail: authUser.email,
          authorUserId: authUser.id,
          forwardedFromMessageId: source.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setMessagesByView((current) => ({
          ...current,
          [forwardKey]: [...(current[forwardKey] || []), forwarded],
        }));
      } else {
        await forwardBoardMessage(forwardMessageId, {
          scope: forwardScope,
          channel: forwardScope === "channel" ? forwardTargetId : undefined,
          recipientUserId: forwardScope === "dm" ? forwardTargetId : undefined,
        });
        if (forwardScope === viewMode && forwardTargetId === activeTargetId) {
          await refreshCurrentConversation();
        }
      }
      setForwardMessageId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to forward message.");
    } finally {
      setBusy(false);
    }
  };

  const canManageMessage = (message: BoardMessage) =>
    message.authorUserId === authUser.id || authUser.roles.includes("Owner") || authUser.roles.includes("Manager");

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 rounded-[28px] border border-slate-200/70 bg-slate-950 p-4 text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)]">
        <section>
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Channels</div>
          <div className="space-y-1">
            {channels.map((channel) => {
              const isActive = viewMode === "channel" && activeTargetId === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => selectChannel(channel.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                    isActive ? "bg-white text-slate-950" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {channel.isPrivate ? <Lock size={14} /> : <Hash size={14} />}
                    {channel.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? "bg-slate-200" : "bg-slate-800"}`}>
                    {channel.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">DM Messages</div>
          <div className="space-y-1">
            {users.map((user) => {
              const isActive = viewMode === "dm" && activeTargetId === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectDm(user.id)}
                  className={`w-full rounded-2xl px-3 py-2.5 text-left transition ${
                    isActive ? "bg-sky-500 text-white" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <div className="truncate text-sm font-semibold">{user.name}</div>
                  <div className={`truncate text-xs ${isActive ? "text-sky-50/90" : "text-slate-400"}`}>
                    {user.lastMessagePreview || user.email}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div
          className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold ${
            syncMode === "POS_DB"
              ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
              : "border-amber-300/40 bg-amber-400/10 text-amber-200"
          }`}
        >
          {syncMode === "POS_DB" ? "Live sync" : "Local fallback"}
        </div>
      </aside>

      <main className="rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {viewMode === "channel" ? "Channel" : "Direct Message"}
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              {viewMode === "channel" ? `#${activeChannel?.name || activeTargetId}` : activeUser?.name || "Select a teammate"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {viewMode === "channel"
                ? "Shared updates for the team."
                : activeUser
                  ? `Private conversation with ${activeUser.email}`
                  : "Choose someone from the DM list."}
            </p>
          </div>

          {viewMode === "channel" ? (
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={priorityDraft}
                onChange={(event) => setPriorityDraft(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Mark next message as priority
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div ref={messageListRef} className="flex h-[58vh] flex-col gap-3 overflow-y-auto px-5 py-5">
          {!messages.length ? (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
              No messages here yet. Send the first one to get this conversation started.
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.authorUserId === authUser.id;
              const isEditing = editingMessageId === message.id;
              return (
                <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`group max-w-[80%] rounded-[26px] px-4 py-3 shadow-sm ${
                      isOwn ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <div className={`flex items-center gap-2 text-xs ${isOwn ? "text-slate-300" : "text-slate-500"}`}>
                      <span className="font-semibold">{message.authorName}</span>
                      <span>{formatStamp(message.createdAt)}</span>
                      {message.priority ? (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${isOwn ? "bg-white/10 text-amber-200" : "bg-amber-100 text-amber-700"}`}>
                          Priority
                        </span>
                      ) : null}
                      {message.forwardedFromMessageId ? (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${isOwn ? "bg-white/10" : "bg-slate-200"}`}>
                          Forwarded
                        </span>
                      ) : null}
                      {message.editedAt ? <span>(edited)</span> : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={editingBody}
                          onChange={(event) => setEditingBody(event.target.value)}
                          rows={3}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit()}
                            disabled={busy}
                            className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditingBody("");
                            }}
                            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`mt-2 whitespace-pre-wrap text-sm ${isOwn ? "text-white" : "text-slate-700"}`}>{renderMessageBody(message.body)}</p>
                    )}

                    {message.attachment ? (
                      <a
                        href={message.attachment.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-3 flex items-center justify-between rounded-2xl px-3 py-2 text-xs ${
                          isOwn ? "bg-white/10 text-white" : "bg-white text-slate-700"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Paperclip size={14} />
                          <span className="truncate">{message.attachment.originalName}</span>
                        </span>
                        <span>{fileSizeLabel(message.attachment.fileSizeBytes)}</span>
                      </a>
                    ) : null}

                    {canManageMessage(message) ? (
                      <div className={`mt-3 flex flex-wrap gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(message)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isOwn ? "bg-white/10 text-white" : "bg-white text-slate-700"
                          }`}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setForwardMessageId(message.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isOwn ? "bg-white/10 text-white" : "bg-white text-slate-700"
                          }`}
                        >
                          <Forward size={12} /> Forward
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(message.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isOwn ? "bg-rose-500/20 text-rose-100" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-5">
          {forwardMessageId ? (
            <div className="mb-4 rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Forward Message</div>
                  <div className="mt-1 text-sm text-slate-700">Choose where to send a copy of this message.</div>
                </div>
                <button type="button" onClick={() => setForwardMessageId(null)} className="text-slate-500 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_auto]">
                <select
                  value={forwardScope}
                  onChange={(event) => {
                    const nextScope = event.target.value === "dm" ? "dm" : "channel";
                    setForwardScope(nextScope);
                    setForwardTargetId(nextScope === "channel" ? channels[0]?.id || "" : users[0]?.id || "");
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
                >
                  <option value="channel">Channel</option>
                  <option value="dm">Direct Message</option>
                </select>
                <select
                  value={forwardTargetId}
                  onChange={(event) => setForwardTargetId(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
                >
                  {(forwardScope === "channel" ? channels : users).map((item) => (
                    <option key={item.id} value={item.id}>
                      {forwardScope === "channel" ? `#${item.name}` : item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleForward()}
                  disabled={busy || !forwardTargetId}
                  className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Send Copy
                </button>
              </div>
            </div>
          ) : null}

          {selectedAttachment.file ? (
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="truncate">
                Attached: <span className="font-semibold">{selectedAttachment.file.name}</span> ({fileSizeLabel(selectedAttachment.file.size)})
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAttachment({ file: null, upload: null });
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-white px-2.5 py-1">Use `@name` or `@channel` to tag people</span>
              <span className="rounded-full bg-white px-2.5 py-1">Images, PDFs, and other files are supported</span>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                placeholder={viewMode === "channel" ? "Insert message into this channel..." : `Message ${activeUser?.name || "this teammate"}...`}
                className="min-h-[92px] flex-1 rounded-3xl border border-white bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex flex-col gap-2 md:w-[190px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedAttachment({ file, upload: null });
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Paperclip size={15} /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={busy || !draft.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Send size={15} /> Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MessageBoard;
