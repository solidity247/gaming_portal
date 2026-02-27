import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { MATCH_PRESETS, MatchPreset } from "./page-data";

function onSelectPreset(preset: MatchPreset) {
  // TODO Launch selected matchmaking
  console.log("Selected to play", preset);
}

export default function BoardPage() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Card className="">
        <CardHeader>
          <CardDescription>Online Matchmaking</CardDescription>
          <CardTitle className="text-xl">Play Online</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm flex">
          <div className="w-1/2 border-r-2">
            <p>Status: Is Playing right now or not</p>
            <p>Balance: 123 coins</p>
          </div>
          <div className="m-auto">
            Client Component, showing if there's an active game
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MATCH_PRESETS.map((preset) => (
          <Card key={preset.id}>
            <CardHeader>
              <CardTitle className="text-lg">{preset.title}</CardTitle>
              <CardDescription>{preset.subtitle}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-1/2 m-auto">Play now</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
