import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import WatchAddDialog from "@/components/watch-add-dialog";
import { getBalance } from "./actions";

export default async function WatchAddsPage() {
  const balance = await getBalance();
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Watch Adds</CardTitle>
          <CardDescription>
            Watch a mock add and claim reward coins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Balance: {balance} coins</p>
        </CardContent>
      </Card>

      <WatchAddDialog />
    </div>
  );
}
