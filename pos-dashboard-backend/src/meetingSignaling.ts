import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";

const MEETING_ROOM_ID = "team-meeting";

type Participant = {
  socketId: string;
  userId: string;
  userName: string;
};

type SDPDescription = {
  type: "offer" | "answer";
  sdp: string;
};

type ICECandidate = {
  candidate: string;
  sdpMLineIndex?: number;
  sdpMid?: string;
};

export function attachMeetingSignaling(httpServer: HttpServer): void {
  const io = new SocketIOServer(httpServer, {
    path: "/fd/api/meeting-socket",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  const rooms = new Map<string, Map<string, Participant>>();

  io.on("connection", (socket) => {
    console.log(`[Meeting] Socket connected: ${socket.id}`);

    socket.on("join-meeting", ({ userName, userId }: { userName: string; userId: string }) => {
      socket.join(MEETING_ROOM_ID);
      if (!rooms.has(MEETING_ROOM_ID)) rooms.set(MEETING_ROOM_ID, new Map());
      const room = rooms.get(MEETING_ROOM_ID)!;
      const participant: Participant = { socketId: socket.id, userId, userName };
      room.set(socket.id, participant);

      console.log(`[Meeting] ${userName} joined. Total: ${room.size}`);

      // Send current participants list to the joiner (everyone else)
      const participants = Array.from(room.values()).filter((p) => p.socketId !== socket.id);
      socket.emit("meeting-participants", participants);

      // Broadcast to everyone else that someone new joined
      socket.to(MEETING_ROOM_ID).emit("participant-joined", participant);
    });

    socket.on("offer", ({ targetId, sdp }: { targetId: string; sdp: SDPDescription }) => {
      io.to(targetId).emit("offer", { fromId: socket.id, sdp });
    });

    socket.on("answer", ({ targetId, sdp }: { targetId: string; sdp: SDPDescription }) => {
      io.to(targetId).emit("answer", { fromId: socket.id, sdp });
    });

    socket.on("ice-candidate", ({ targetId, candidate }: { targetId: string; candidate: ICECandidate }) => {
      io.to(targetId).emit("ice-candidate", { fromId: socket.id, candidate });
    });

    socket.on("take-stage", () => {
      io.to(MEETING_ROOM_ID).emit("stage-changed", { socketId: socket.id });
    });

    socket.on("leave-stage", () => {
      io.to(MEETING_ROOM_ID).emit("stage-changed", { socketId: null });
    });

    socket.on("meeting-chat", (message: any) => {
      io.to(MEETING_ROOM_ID).emit("meeting-chat", message);
    });

    socket.on("disconnect", () => {
      const room = rooms.get(MEETING_ROOM_ID);
      if (room) {
        const p = room.get(socket.id);
        if (p) console.log(`[Meeting] ${p.userName} left`);
        room.delete(socket.id);
        if (room.size === 0) rooms.delete(MEETING_ROOM_ID);
      }
      io.to(MEETING_ROOM_ID).emit("participant-left", { socketId: socket.id });
    });
  });
}
