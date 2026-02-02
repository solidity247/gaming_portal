"use client";

import { useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";

/**
 * useSocket — create and manage a persistent Socket.IO connection
 * @param url - backend websocket URL (e.g. "http://localhost:3300")
 * @param authToken - optional token for authentication
 */
export function useSocket(
  url: string,
  userId: string | null,
): typeof Socket | null {
  const socketRef = useRef<typeof Socket | null>(null);

  useEffect(() => {
    // avoid duplicate connections
    if (socketRef.current) return;

    const socket = io(url, {
      transports: ["websocket"],
      auth: { token: "someSecret!!![TODO]", userId },
    });

    socket.on("connect", () => {
      console.log("🟢 Connected to socket:", socket.id);
      socket.emit("subscriberData", { userId });
    });
    socket.on("connect", () => {
      console.log("🟢 Connected to socket:", socket.id);
    });

    // socket.on("disconnect", (reason: ) => {
    //   console.log("🔴 Disconnected:", reason);
    // });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, userId]);

  return socketRef.current;
}

// const eventHandlers = {
//   message: () => {},
//   update: () => {},
// };
