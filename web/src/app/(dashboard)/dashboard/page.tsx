import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center gap-6 py-16">
      <h1 className="text-2xl font-semibold">Dashboard — Coming Soon</h1>
      <p className="text-center text-muted-foreground">
        KPIs and overview will appear here in a future update.
      </p>
      <Button asChild>
        <Link href="/cars">Go to Inventory</Link>
      </Button>
    </div>
  );
}
