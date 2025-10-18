import { defaultBoardData } from "@/lib/bg_data/defBoardData";
import BGBoard from "../../components/ui/client-apps/backbammon-app/BGBoard";

export default function BoardPage() {
  return (
    <div>
      WRAPPER
      <div className="border-2 mx-50 h-160 p-4">
        <BGBoard boardData={defaultBoardData} />
      </div>
    </div>
  );
}
