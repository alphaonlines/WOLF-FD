import { useEffect, useRef, useState } from "react";
import { getMeetingSocket, destroyMeetingSocket } from "../services/meetingSocket";
import { fetchBoardMessages, createBoardMessage, uploadBoardAttachment } from "../services/messageBoardApi";
import type { Socket } from "socket.io-client";
import type { BoardMessage, BoardUpload } from "../types";

export type Participant = {
  socketId: string;
  userId: string;
  userName: string;
};

export type MeetingChatMessage = {
  id: string;
  userName: string;
  body: string;
  attachment: BoardUpload | null;
  timestamp: string;
};

export type UseMeetingRoomReturn = {
  joined: boolean;
  participants: Participant[];
  localStream: MediaStream | null;
  compositeStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  stageSocketId: string | null;
  chatMessages: MeetingChatMessage[];
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  mySocketId: string | null;
  joinMeeting: (userName: string, userId: string) => Promise<void>;
  leaveMeeting: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  takeStage: () => void;
  leaveStage: () => void;
  sendChatMessage: (body: string, file?: File) => Promise<void>;
};

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function useMeetingRoom(): UseMeetingRoomReturn {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [stageSocketId, setStageSocketId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [compositeStream, setCompositeStream] = useState<MediaStream | null>(null);

  const createPeerConnection = (remoteSocketId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          targetId: remoteSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(remoteSocketId, event.streams[0]);
        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        pc.close();
        peerConnectionsRef.current.delete(remoteSocketId);
      }
    };

    peerConnectionsRef.current.set(remoteSocketId, pc);
    return pc;
  };

  const joinMeeting = async (userName: string, userId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });

      localStreamRef.current = stream;

      const socket = getMeetingSocket();
      socketRef.current = socket;

      socket.on("connect", () => {
        setMySocketId(socket.id || null);
        socket.emit("join-meeting", { userName, userId });
      });

      socket.on("meeting-participants", async (existingParticipants: Participant[]) => {
        setParticipants(existingParticipants);

        try {
          const history = await fetchBoardMessages({
            scope: "channel" as const,
            channel: "meeting-room",
          });
          const boardMessages = Array.isArray(history) ? history : history?.messages || [];
          const converted: MeetingChatMessage[] = boardMessages.map((msg: BoardMessage) => ({
            id: msg.id,
            userName: msg.authorName,
            body: msg.body,
            attachment: msg.attachment,
            timestamp: msg.createdAt,
          }));
          setChatMessages(converted);
        } catch (err) {
          console.error("Failed to load meeting chat history:", err);
        }

        existingParticipants.forEach((participant) => {
          const pc = createPeerConnection(participant.socketId);

          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              socket.emit("offer", {
                targetId: participant.socketId,
                sdp: pc.localDescription,
              });
            })
            .catch((err) => console.error("Offer error:", err));
        });
      });

      socket.on("participant-joined", (participant: Participant) => {
        setParticipants((prev) => [...prev, participant]);
      });

      socket.on("offer", async ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
        let pc = peerConnectionsRef.current.get(fromId);
        if (!pc) {
          pc = createPeerConnection(fromId);
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          const buffered = pendingCandidatesRef.current.get(fromId) || [];
          for (const candidate of buffered) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("Error adding buffered candidate:", err);
            }
          }
          pendingCandidatesRef.current.delete(fromId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", {
            targetId: fromId,
            sdp: pc.localDescription,
          });
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      });

      socket.on("answer", async ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
        const pc = peerConnectionsRef.current.get(fromId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));

            const buffered = pendingCandidatesRef.current.get(fromId) || [];
            for (const candidate of buffered) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error("Error adding buffered candidate:", err);
              }
            }
            pendingCandidatesRef.current.delete(fromId);
          } catch (err) {
            console.error("Error handling answer:", err);
          }
        }
      });

      socket.on("ice-candidate", async ({ fromId, candidate }: { fromId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnectionsRef.current.get(fromId);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        } else if (!pc?.remoteDescription) {
          if (!pendingCandidatesRef.current.has(fromId)) {
            pendingCandidatesRef.current.set(fromId, []);
          }
          pendingCandidatesRef.current.get(fromId)!.push(candidate);
        }
      });

      socket.on("stage-changed", ({ socketId }: { socketId: string | null }) => {
        setStageSocketId(socketId);
      });

      socket.on("participant-left", ({ socketId }: { socketId: string }) => {
        const pc = peerConnectionsRef.current.get(socketId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(socketId);
        }
        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
        if (stageSocketId === socketId) {
          setStageSocketId(null);
        }
      });

      socket.on("meeting-chat", (message: MeetingChatMessage) => {
        setChatMessages((prev) => [...prev, message]);
      });

      socket.connect();
      setJoined(true);
    } catch (err) {
      console.error("Failed to join meeting:", err);
      throw err;
    }
  };

  const leaveMeeting = () => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    compositeStreamRef.current?.getTracks().forEach((track) => track.stop());

    localStreamRef.current = null;
    screenStreamRef.current = null;
    compositeStreamRef.current = null;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    destroyMeetingSocket();

    setParticipants([]);
    setRemoteStreams(new Map());
    setStageSocketId(null);
    setChatMessages([]);
    setJoined(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setMySocketId(null);
    setCompositeStream(null);
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      try {
        screenStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        compositeStreamRef.current?.getTracks().forEach((track) => track.stop());
        compositeStreamRef.current = null;
        setCompositeStream(null);

        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender && videoTrack) {
              sender.replaceTrack(videoTrack).catch((err) => console.error("Error reverting track:", err));
            }
          });
        }
        setIsScreenSharing(false);
      } catch (err) {
        console.error("Error stopping screen share:", err);
      }
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false,
        });

        screenStreamRef.current = displayStream;
        const screenVideoTrack = displayStream.getVideoTracks()[0];

        if (screenVideoTrack && localStreamRef.current) {
          const webcamVideoTrack = localStreamRef.current.getVideoTracks()[0];

          const canvas = document.createElement("canvas");
          canvas.width = 1920;
          canvas.height = 1080;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Failed to get canvas context");

          const screenVideo = document.createElement("video");
          screenVideo.srcObject = displayStream;
          screenVideo.play().catch((err) => console.error("Error playing screen video:", err));

          const webcamVideo = document.createElement("video");
          webcamVideo.srcObject = localStreamRef.current;
          webcamVideo.play().catch((err) => console.error("Error playing webcam video:", err));

          const drawFrame = () => {
            ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

            const webcamTrack = localStreamRef.current?.getVideoTracks()[0];
            if (webcamTrack && webcamTrack.enabled) {
              const pipSize = 200;
              const pipX = canvas.width - pipSize - 20;
              const pipY = canvas.height - pipSize - 20;
              ctx.drawImage(webcamVideo, pipX, pipY, pipSize, pipSize);

              ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
              ctx.lineWidth = 2;
              ctx.strokeRect(pipX, pipY, pipSize, pipSize);
            }

            requestAnimationFrame(drawFrame);
          };

          const compositeStreamLocal = canvas.captureStream(30);
          const compositeVideoTrack = compositeStreamLocal.getVideoTracks()[0];
          compositeStreamRef.current = compositeStreamLocal;
          setCompositeStream(compositeStreamLocal);

          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender && compositeVideoTrack) {
              sender.replaceTrack(compositeVideoTrack).catch((err) => console.error("Error replacing track:", err));
            }
          });

          drawFrame();

          screenVideoTrack.onended = () => {
            if (isScreenSharing) {
              toggleScreenShare().catch((err) => console.error("Error auto-reverting screen share:", err));
            }
          };
        }

        setIsScreenSharing(true);
      } catch (err) {
        if ((err as DOMException).name !== "NotAllowedError") {
          console.error("Error starting screen share:", err);
        }
      }
    }
  };

  const takeStage = () => {
    socketRef.current?.emit("take-stage");
  };

  const leaveStage = () => {
    socketRef.current?.emit("leave-stage");
  };

  const sendChatMessage = async (body: string, file?: File) => {
    try {
      let attachment: BoardUpload | null = null;
      if (file) {
        attachment = await uploadBoardAttachment(file);
      }

      const msg = await createBoardMessage({
        scope: "channel",
        channel: "meeting-room",
        body,
        priority: false,
        attachmentUploadId: attachment?.id,
      });

      const chatMsg: MeetingChatMessage = {
        id: msg.id,
        userName: msg.authorName,
        body: msg.body,
        attachment: msg.attachment,
        timestamp: msg.createdAt,
      };

      setChatMessages((prev) => [...prev, chatMsg]);
      socketRef.current?.emit("meeting-chat", chatMsg);
    } catch (err) {
      console.error("Failed to send chat message:", err);
      throw err;
    }
  };

  useEffect(() => {
    return () => {
      if (joined) {
        leaveMeeting();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    joined,
    participants,
    localStream: localStreamRef.current,
    compositeStream,
    remoteStreams,
    stageSocketId,
    chatMessages,
    isMuted,
    isCameraOff,
    isScreenSharing,
    mySocketId,
    joinMeeting,
    leaveMeeting,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    takeStage,
    leaveStage,
    sendChatMessage,
  };
}
