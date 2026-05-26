"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Car, User, FileImage, FileText as FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SharedFile {
  name: string;
  type: string;
  blob: Blob;
}

interface SharedItem {
  id?: number;
  receivedAt: number;
  title?: string;
  text?: string;
  url?: string;
  files: SharedFile[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("monza-share-inbox", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("items", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadLatest(): Promise<SharedItem | null> {
  // Plain `async` function with try/catch — an async executor passed to
  // `new Promise(async ...)` would swallow any thrown errors before `resolve`,
  // so we use the awaited callback shape and wrap the IndexedDB callback step
  // in a small inner Promise instead.
  try {
    const db = await openDb();
    const tx = db.transaction("items", "readonly");
    const store = tx.objectStore("items");
    return await new Promise<SharedItem | null>((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as SharedItem[]) ?? [];
        if (!items.length) return resolve(null);
        items.sort((a, b) => b.receivedAt - a.receivedAt);
        resolve(items[0]);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function clearInbox(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction("items", "readwrite");
    tx.objectStore("items").clear();
  } catch {}
}

export default function ShareInboxPage() {
  const [item, setItem] = useState<SharedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    // Capture URLs created inside this effect in a local so the cleanup
    // function can revoke exactly the URLs it allocated, even after the
    // setState re-render. Reading `previewUrls` in cleanup would close over
    // the initial empty array and leak the blobs.
    let createdUrls: string[] = [];
    void loadLatest().then((it) => {
      setItem(it);
      setLoading(false);
      if (it) {
        createdUrls = it.files.map((f) => URL.createObjectURL(f.blob));
        setPreviewUrls(createdUrls);
      }
    });
    return () => {
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  async function handleDismiss() {
    await clearInbox();
    setItem(null);
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setPreviewUrls([]);
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading shared content…</div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Share inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing shared into Monza right now. From your phone or laptop, use
          the OS share sheet and pick &quot;Monza&quot; to send a photo or PDF
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Share received</h1>
        <p className="text-sm text-muted-foreground">
          Choose where to attach this content. The file stays on your device
          until you save it to a record.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {item.title && (
            <div>
              <p className="text-xs uppercase text-muted-foreground">Title</p>
              <p>{item.title}</p>
            </div>
          )}
          {item.text && (
            <div>
              <p className="text-xs uppercase text-muted-foreground">Text</p>
              <p className="whitespace-pre-wrap break-words">{item.text}</p>
            </div>
          )}
          {item.url && (
            <div>
              <p className="text-xs uppercase text-muted-foreground">URL</p>
              <a className="break-all text-primary underline" href={item.url}>
                {item.url}
              </a>
            </div>
          )}
          {item.files.length > 0 && (
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Files ({item.files.length})
              </p>
              <ul className="mt-1 space-y-2">
                {item.files.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-md border p-2">
                    {f.type.startsWith("image/") && previewUrls[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrls[i]}
                        alt={f.name}
                        className="size-14 shrink-0 rounded object-cover"
                      />
                    ) : f.type === "application/pdf" ? (
                      <FileTextIcon className="size-6 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileImage className="size-6 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm">{f.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-auto justify-start py-3">
          <Link href="/cars">
            <Car className="mr-2 size-5" />
            <span className="flex flex-col items-start">
              <span className="font-medium">Attach to a car</span>
              <span className="text-xs text-muted-foreground">
                Pick a car to attach this file
              </span>
            </span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start py-3">
          <Link href="/customers">
            <User className="mr-2 size-5" />
            <span className="flex flex-col items-start">
              <span className="font-medium">Attach to a customer</span>
              <span className="text-xs text-muted-foreground">
                Pick a customer to attach this file
              </span>
            </span>
          </Link>
        </Button>
      </div>

      <div>
        <Button variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
          Discard this share
        </Button>
      </div>
    </div>
  );
}
