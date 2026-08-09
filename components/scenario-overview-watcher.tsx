"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { useCurrentScenarioSlide } from "@/lib/use-scenario-overview";
import { ScenarioOverviewOverlay } from "./scenario-overview-overlay";

interface ScenarioOverviewResponse {
  startedAt: string | null;
  landingPath: string | null;
}

// Update 3's shared trigger: mounted once in the (dashboard) layout, the
// (instructor) layout, and the display page (passing displayToken), so
// every connected screen picks up the same broadcast and shows the same
// slide at the same moment — see lib/use-scenario-overview.ts for how the
// slide index is derived and app/api/scenario-overview/route.ts for the
// lightweight polling endpoint this hits every 5s.
//
// displayToken is only set on the public projector display: passing it
// switches the request to the token-authenticated path and — critically —
// suppresses the post-sequence redirect below, since the projector must
// never navigate away from /display/[token].
export function ScenarioOverviewWatcher({ displayToken }: { displayToken?: string } = {}) {
  const router = useRouter();
  const url = displayToken ? `/api/scenario-overview?token=${encodeURIComponent(displayToken)}` : "/api/scenario-overview";

  const { data } = useQuery({
    queryKey: ["scenario-overview", displayToken ?? "self"],
    queryFn: () => apiFetch<ScenarioOverviewResponse>(url),
    refetchInterval: 5000,
  });

  const slide = useCurrentScenarioSlide(data?.startedAt);

  // Fires the post-sequence redirect exactly once per run: wasActive flips
  // true the moment a slide first renders, and the transition back to
  // `slide === null` — active -> finished — is what triggers navigation.
  // Without the ref, every render while there's simply no active deck
  // (startedAt null, e.g. before the instructor has pressed the button)
  // would look identical to "just finished" and redirect immediately.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (slide) {
      wasActiveRef.current = true;
      return;
    }
    if (wasActiveRef.current) {
      wasActiveRef.current = false;
      if (data?.landingPath) router.push(data.landingPath);
    }
  }, [slide, data?.landingPath, router]);

  if (!slide) return null;
  return <ScenarioOverviewOverlay slide={slide} />;
}
