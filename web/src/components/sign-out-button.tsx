"use client";

import { signOut } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
