import BgGameProvider from "@/bg_client_app/BgGameProvider";
import { auth } from "@clerk/nextjs/server";

export default async function BoardPage() {
  const userId = await auth();
  console.log(userId);

  return (
    <div>
      WRAPPER
      <div className="border-2 mx-50 h-160 p-4">
        <BgGameProvider />
      </div>
    </div>
  );
}
