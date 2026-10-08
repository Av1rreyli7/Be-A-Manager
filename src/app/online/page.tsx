"use client";
/**
 * The old friends page. Creating, joining and the room now live on the Front Office entry (/gm), the same way
 * Floodlights works; old links and invites land there with their code.
 */
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCourtMode } from "@/lib/theme";

function Forward() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const q = new URLSearchParams();
    const code = params.get("code");
    if (code) q.set("code", code);
    if (params.get("rejoin") === "1") q.set("rejoin", "1");
    router.replace(`/gm${q.size ? `?${q}` : ""}`);
  }, [params, router]);
  return null;
}

export default function OnlinePage() {
  useCourtMode();
  return (
    <div data-kmode="court" className="min-h-[100dvh]">
      <Suspense>
        <Forward />
      </Suspense>
    </div>
  );
}
