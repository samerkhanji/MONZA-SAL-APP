import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <h1 className="text-3xl font-bold tracking-tight">Monza Tech CRM</h1>
      <p className="text-center text-muted-foreground">
        Internal system — car inventory & operations
      </p>
      <Button asChild size="lg">
        <Link href="/cars">Go to Cars</Link>
      </Button>
      <p className="text-muted-foreground text-xs">
        If you see &quot;To get started, edit page.tsx&quot; you are in the wrong app. Run from the <code className="rounded bg-muted px-1 py-0.5">web</code> folder.
      </p>
    </div>
  );
}
