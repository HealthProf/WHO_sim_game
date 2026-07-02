"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { REGIONS } from "@/lib/regions";

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
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">Coordination</h2>
      <p className="text-sm text-slate-400">
        Broadcast messages are visible to every region. Private channel messages are visible only to you, the
        recipient, and the instructor — <span className="text-amber-400">unless it leaks</span>. Every private
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
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
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
            className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2">Send</button>
        </div>
      </form>
      {lastLeakWarning && <p className="text-sm text-red-400">{lastLeakWarning}</p>}

      <div className="space-y-2">
        {(data?.messages ?? [])
          .slice()
          .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
          .map((m) => (
            <div key={m.id} className={`bg-slate-900 border rounded-lg p-3 text-sm ${m.toTeamId ? "border-purple-800" : "border-slate-800"}`}>
              <div className="flex items-center gap-2">
                {m.toTeamId && <span className="text-[10px] uppercase font-semibold rounded-full px-2 py-0.5 bg-purple-950 text-purple-300">Private</span>}
                {m.leaked && <span className="text-[10px] uppercase font-semibold rounded-full px-2 py-0.5 bg-red-950 text-red-300">Leaked</span>}
              </div>
              <p className="text-slate-200 mt-1">{m.messageText}</p>
              <p className="text-xs text-slate-500 mt-1">{new Date(m.sentAt).toLocaleTimeString()}</p>
            </div>
          ))}
        {data?.messages.length === 0 && <p className="text-slate-500 text-sm">No messages yet.</p>}
      </div>
    </div>
  );
}
