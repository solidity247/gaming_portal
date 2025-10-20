import { GameCards } from "@/app/portal/game-cards";

export default async function PortalPage() {
  // console.log("RENDER PORTAL PAGE");
  return (
    <div>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <GameCards />
          <div className="px-4 lg:px-6"></div>
        </div>
      </div>
    </div>
  );
}
