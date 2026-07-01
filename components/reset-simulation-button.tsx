"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

// Lives in the persistent instructor header (not the Command Center page
// body) so it's reachable from every instructor screen, including after
// End Game when the instructor may never navigate back to Command Center.
export function ResetSimulationButton() {
  const qc = useQueryClient();

  const resetSimulation = useMutation({
    mutationFn: () => apiFetch("/api/instructor/reset", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["scoring-inbox"] });
      qc.invalidateQueries({ queryKey: ["summary-report"] });
      qc.invalidateQueries({ queryKey: ["instructor-log"] });
    },
  });

  function handleReset() {
    const typed = window.prompt(
      "This permanently deletes every decision, score, and dispatched event, and resets all regions to their starting values. Team logins are not affected. Type RESET to confirm."
    );
    if (typed === "RESET") {
      resetSimulation.mutate();
    }
  }

  return (
    <button
      onClick={handleReset}
      disabled={resetSimulation.isPending}
      className="rounded-md bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5"
    >
      {resetSimulation.isPending ? "Resetting..." : "Reset Simulation"}
    </button>
  );
}
