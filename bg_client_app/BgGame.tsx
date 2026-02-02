import { useSocket } from "@/hooks/use-socket";
import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

// interface ServerMessage {
//   msg: string;
//   content: string;
// }

export default function WholeBoard() {
  const { user } = useUser();
  const socket = useSocket("http://localhost:3300", user?.id || null);

  useEffect(() => {
    console.log("useEffect");
    if (!socket) return;

    socket.on("connectionResponse", (data: string) => {
      console.log("Received:", data);
    });

    return () => {
      socket.off("connectionResponse");
    };
  }, [socket]);

  return <div>Whole Board</div>;
}
