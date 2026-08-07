"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { REGIONS } from "@/lib/regions";
import { Chip } from "@/components/ui/chip";
import { PillButton } from "@/components/ui/pill-button";

interface Message {
  id: number;
  fromTeamId: number;
  toTeamId: number | null;
  messageText: string;
  sentAt: string;
  leaked: boolean;
}

interface DashboardData {
  ownRegion: { regionId: string } | null;
}


export default function CoordinationPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<"broadcast" | string>("broadcast"); // "broadcast" or a region code
  const [lastLeakWarning, setLastLeakWarning] = useState<string | null>(null);

  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard") });
  const { data } = useQuery({
    queryKey: ["coordination"],
    queryFn: () => apiFetch<{ messages: Message[] }>("/api/coordination"),
    refetchInterval: 10000,
  });

  const send = useMutation({
    mutationFn: () =>
      apiFetch<{ message: Message; leaked: boolean }>("/api/coordination", {
        method: "POST",
        body: JSON.stringify({ messageText: text, toRegionId: channel === "broadcast" ? null : channel }),
      }),
    onSuccess: (res) => {
      setText("");
      setLastLeakWarning(res.leaked ? "That message leaked to the public feed — everyone can now see it." : null);
      qc.invalidateQueries({ queryKey: ["coordination"] });
    },
  });

  const ownRegion = dash?.ownRegion?.regionId;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="font-heading text-[32px] text-text">Coordination</h1>
      <p className="text-sm text-neutral-700">
        Broadcast messages are visible to every region. Private channel messages are visible only to you, the
        recipient, and the instructor — <span className="font-medium text-accent-700">unless it leaks</span>. Every private
        message has roughly a 1-in-7 chance of being compromised and copied to the public projector feed the moment
        you send it, so treat &quot;private&quot; as a gamble, not a guarantee.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
        className="space-y-2"
      >
        <div className="flex gap-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
          >
            <option value="broadcast">Broadcast (all regions)</option>
            {REGIONS.filter((r) => r !== ownRegion).map((r) => (
              <option key={r} value={r}>
                Private channel → {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={channel === "broadcast" ? "Post a message to all regions..." : "Send a private message..."}
            className="flex-1 rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
          />
          <PillButton type="submit" tone="accent">Send</PillButton>
        </div>
      </form>
      {lastLeakWarning && <p className="text-sm font-medium text-accent-800">{lastLeakWarning}</p>}

      <div className="space-y-2">
        {(data?.messages ?? [])
          .slice()
          .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
          .map((m) => (
            <div key={m.id} className="rounded-lg bg-surface p-3 text-sm">
              <div className="flex items-center gap-2">
                {m.toTeamId && <Chip tone="neutral-soft">Private</Chip>}
                {m.leaked && <Chip tone="accent-soft">Leaked</Chip>}
              </div>
              <p className="mt-1 text-text">{m.messageText}</p>
              <p className="mt-1 text-xs text-neutral-600">{new Date(m.sentAt).toLocaleTimeString()}</p>
            </div>
          ))}
        {data?.messages.length === 0 && <p className="text-sm text-neutral-600">No messages yet.</p>}
      </div>
    </div>
  );
}
