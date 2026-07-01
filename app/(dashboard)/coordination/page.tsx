"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

interface Message {
  id: number;
  fromTeamId: number;
  toTeamId: number | null;
  messageText: string;
  sentAt: string;
}

export default function CoordinationPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data } = useQuery({
    queryKey: ["coordination"],
    queryFn: () => apiFetch<{ messages: Message[] }>("/api/coordination"),
    refetchInterval: 10000,
  });

  const send = useMutation({
    mutationFn: () => apiFetch("/api/coordination", { method: "POST", body: JSON.stringify({ messageText: text, toTeamId: null }) }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["coordination"] });
    },
  });

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">Coordination Log</h2>
      <p className="text-sm text-slate-400">
        Broadcast to all regions. This log is visible to every team and the instructor — it's the institutional
        record of who coordinated with whom, and when.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Post a message to all regions..."
          className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2">Send</button>
      </form>

      <div className="space-y-2">
        {(data?.messages ?? [])
          .slice()
          .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
          .map((m) => (
            <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm">
              <p className="text-slate-200">{m.messageText}</p>
              <p className="text-xs text-slate-500 mt-1">{new Date(m.sentAt).toLocaleTimeString()}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
