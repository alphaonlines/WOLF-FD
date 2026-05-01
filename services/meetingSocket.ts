import { io, type Socket } from "socket.io-client";
import { getPosApiBaseUrl } from "./posBackendApi";

let _socket: Socket | null = null;

export function getMeetingSocket(): Socket {
  if (!_socket) {
    const base = getPosApiBaseUrl();
    _socket = io(base, {
      path: "/fd/api/meeting-socket",
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return _socket;
}

export function destroyMeetingSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
