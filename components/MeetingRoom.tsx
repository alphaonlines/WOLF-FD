import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, LogOut, Star, Paperclip, Send } from "lucide-react";
import type { AuthUser } from "../types";
import { useMeetingRoom } from "../hooks/useMeetingRoom";

type MeetingRoomProps = {
  isDarkMode: boolean;
  authUser: AuthUser;
};

function VideoTile({
  stream,
  muted,
  label,
  isStage,
  isDarkMode,
}: {
  stream: MediaStream | null;
  muted: boolean;
  label: string;
  isStage: boolean;
  isDarkMode: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const bgClass = isDarkMode ? "bg-slate-900" : "bg-slate-100";
  const roundedClass = isStage ? "rounded-[28px]" : "rounded-2xl";

  return (
    <div className={`relative ${roundedClass} overflow-hidden border ${isDarkMode ? "border-slate-800" : "border-slate-200"} aspect-video ${bgClass}`}>
      <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 left-3 text-xs font-semibold text-white drop-shadow-lg truncate max-w-[80%]">{label}</div>
    </div>
  );
}

function ChatPanel({
  isDarkMode,
  messages,
  onSendMessage,
  authUser,
}: {
  isDarkMode: boolean;
  messages: any[];
  onSendMessage: (body: string, file?: File) => Promise<void>;
  authUser: AuthUser;
}) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const panelClass = isDarkMode ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900";
  const mutedClass = isDarkMode ? "text-slate-400" : "text-slate-500";
  const innerClass = isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setIsSending(true);
    try {
      await onSendMessage(input);
      setInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file && input.trim()) {
      setIsSending(true);
      try {
        await onSendMessage(input, file);
        setInput("");
      } catch (err) {
        console.error("Failed to send file:", err);
      } finally {
        setIsSending(false);
      }
      e.currentTarget.value = "";
    }
  };

  const renderMessageBody = (body: string) => {
    return body.replace(/#([\w-]+)/g, (match, channel) => {
      return `<span class="text-amber-500 font-semibold">${match}</span>`;
    });
  };

  const BOARD_CHANNELS = ["announcements", "sales-floor", "operations", "inventory", "marketing", "leadership"];

  return (
    <div className={`flex flex-col h-full border-l ${panelClass}`}>
      <div className={`border-b ${isDarkMode ? "border-slate-800" : "border-slate-200"} px-4 py-3`}>
        <h3 className="font-semibold text-sm">Meeting Chat</h3>
      </div>

      <div className={`flex-1 overflow-y-auto flex flex-col gap-3 p-4 ${innerClass}`}>
        {messages.length === 0 ? (
          <div className={`text-xs text-center ${mutedClass} py-8`}>No messages yet</div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id || idx} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{msg.userName}</span>
                <span className={`text-xs ${mutedClass}`}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: renderMessageBody(msg.body) }} />
              {msg.attachment && (
                <a
                  href={msg.attachment.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-500 hover:underline flex items-center gap-1 mt-1"
                >
                  📎 {msg.attachment.originalName}
                </a>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`border-t ${isDarkMode ? "border-slate-800" : "border-slate-200"} px-3 py-3 space-y-2`}>
        <div className="flex flex-wrap gap-1">
          {BOARD_CHANNELS.map((ch) => (
            <button
              key={ch}
              onClick={() => setInput((prev) => (prev ? prev + ` #${ch}` : `#${ch}`))}
              className={`text-xs px-2 py-1 rounded-full transition-all ${
                isDarkMode
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              #{ch}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className={`flex-1 px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
              isDarkMode
                ? "border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-amber-500"
                : "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-amber-400"
            }`}
            disabled={isSending}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className={`p-2 rounded-lg transition-all ${
              isDarkMode
                ? "bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            }`}
            title="Attach file"
          >
            <Paperclip size={16} />
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={`p-2 rounded-lg transition-all disabled:opacity-50 ${
              isDarkMode
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                : "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100"
            }`}
            title="Send message"
          >
            <Send size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="*"
          />
        </div>
      </div>
    </div>
  );
}

const MeetingRoom: React.FC<MeetingRoomProps> = ({ isDarkMode, authUser }) => {
  const [nameInput, setNameInput] = useState(authUser.name || "");
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const { joined, participants, localStream, compositeStream, remoteStreams, stageSocketId, chatMessages, isMuted, isCameraOff, isScreenSharing, mySocketId, joinMeeting, leaveMeeting, toggleMute, toggleCamera, toggleScreenShare, takeStage, leaveStage, sendChatMessage } = useMeetingRoom();

  const panelClass = isDarkMode ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900";
  const mutedClass = isDarkMode ? "text-slate-400" : "text-slate-500";
  const innerPanelClass = isDarkMode ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50";

  const handleJoinClick = async () => {
    try {
      await joinMeeting(nameInput, authUser.id);
    } catch (err) {
      console.error("Failed to join:", err);
    }
  };

  const handleLeaveClick = () => {
    leaveMeeting();
  };

  useEffect(() => {
    if (!joined && nameInput) {
      navigator.mediaDevices
        .getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        })
        .then((stream) => {
          previewStreamRef.current = stream;
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => console.error("Preview error:", err));
    }

    return () => {
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [joined]);

  if (!joined) {
    return (
      <div className="h-full overflow-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <section className={`rounded-[28px] border p-6 shadow-sm ${panelClass}`}>
            <h2 className="text-2xl font-semibold mb-2">Join Meeting</h2>
            <p className={`text-sm ${mutedClass} mb-6`}>Welcome to the team meeting room. Enter your name to join.</p>

            <div className="space-y-4">
              <div>
                <div className={`rounded-2xl overflow-hidden border aspect-video mb-4 ${innerPanelClass}`}>
                  <video ref={previewVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
                <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Your Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className={`w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-amber-500" : "border-slate-200 bg-white text-slate-900 focus:border-amber-400"}`}
                />
              </div>

              <button
                onClick={handleJoinClick}
                disabled={!nameInput.trim()}
                className={`w-full py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:hover:bg-amber-500/15"
                    : "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 disabled:hover:bg-amber-50"
                }`}
              >
                Join Meeting
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  let stageStream: MediaStream | null = null;
  if (stageSocketId === mySocketId) {
    stageStream = isScreenSharing ? compositeStream : localStream;
  } else if (stageSocketId) {
    stageStream = remoteStreams.get(stageSocketId) || null;
  }

  const stageParticipant = stageSocketId ? participants.find((p) => p.socketId === stageSocketId) || { socketId: stageSocketId, userName: "Unknown", userId: "" } : null;

  return (
    <div className="h-full overflow-hidden flex">
      {/* Main video area */}
      <div className="flex-1 flex flex-col px-4 py-4 sm:px-6 gap-4">
        <div className="mx-auto w-full max-w-4xl flex flex-col gap-4 flex-1">
          <section className={`rounded-[28px] border p-5 shadow-sm ${panelClass} flex-1 flex flex-col`}>
            <h2 className="text-lg font-semibold mb-4">Meeting Room</h2>

            <div className="flex-1 flex flex-col gap-4 min-h-0">
              <div className="flex-1 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
                {stageStream ? (
                  <VideoTile stream={stageStream} muted={false} label={stageParticipant?.userName || "Stage"} isStage={true} isDarkMode={isDarkMode} />
                ) : (
                  <div className={`h-full flex items-center justify-center ${isDarkMode ? "bg-slate-900" : "bg-slate-100"} text-center`}>
                    <div>
                      <div className={`text-sm font-semibold ${mutedClass}`}>No one on stage</div>
                      <div className={`text-xs ${mutedClass} mt-1`}>Someone take the stage to present</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-40">
                <div className="relative aspect-video rounded-xl overflow-hidden border border-amber-500/30 bg-amber-500/5">
                  <VideoTile stream={localStream} muted={true} label={authUser.name} isStage={false} isDarkMode={isDarkMode} />
                  {isCameraOff && <div className={`absolute inset-0 flex items-center justify-center ${isDarkMode ? "bg-slate-950/80" : "bg-slate-100/80"}`} />}
                </div>

                {participants.map((p) => (
                  <div key={p.socketId} className={`relative aspect-video rounded-xl overflow-hidden border ${stageSocketId === p.socketId ? "border-amber-500/50" : "border-slate-700"} bg-slate-900`}>
                    <VideoTile stream={remoteStreams.get(p.socketId) || null} muted={false} label={p.userName} isStage={false} isDarkMode={isDarkMode} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800">
              <button
                onClick={toggleMute}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  isMuted
                    ? isDarkMode
                      ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                      : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    : isDarkMode
                      ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                }`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                {isMuted ? "Muted" : "Mic"}
              </button>

              <button
                onClick={toggleCamera}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  isCameraOff
                    ? isDarkMode
                      ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                      : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    : isDarkMode
                      ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                }`}
                title={isCameraOff ? "Turn camera on" : "Turn camera off"}
              >
                {isCameraOff ? <VideoOff size={16} /> : <Video size={16} />}
                {isCameraOff ? "Camera Off" : "Camera"}
              </button>

              <button
                onClick={() => toggleScreenShare().catch((err) => console.error(err))}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  isScreenSharing
                    ? isDarkMode
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                      : "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100"
                    : isDarkMode
                      ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                }`}
                title={isScreenSharing ? "Stop sharing" : "Share screen"}
              >
                <Monitor size={16} />
                {isScreenSharing ? "Sharing" : "Share"}
              </button>

              <button
                onClick={() => (stageSocketId === mySocketId ? leaveStage() : takeStage())}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  stageSocketId === mySocketId
                    ? isDarkMode
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                      : "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100"
                    : isDarkMode
                      ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                }`}
                title={stageSocketId === mySocketId ? "Leave stage" : "Take the stage"}
              >
                <Star size={16} />
                {stageSocketId === mySocketId ? "On Stage" : "Take Stage"}
              </button>

              <button
                onClick={handleLeaveClick}
                className={`ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  isDarkMode
                    ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                    : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                }`}
                title="Leave meeting"
              >
                <LogOut size={16} />
                Leave
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Chat panel on the right */}
      <div className={`w-80 border-l ${panelClass} flex flex-col`}>
        <ChatPanel isDarkMode={isDarkMode} messages={chatMessages} onSendMessage={sendChatMessage} authUser={authUser} />
      </div>
    </div>
  );
};

export default MeetingRoom;
