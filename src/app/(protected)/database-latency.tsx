"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Props = { authUserId: string };
type PingState =
  | { status: "checking" }
  | { status: "ok"; latencyMs: number }
  | { status: "error" };

export function DatabaseLatency({ authUserId }: Props) {
  const [ping, setPing] = useState<PingState>({ status: "checking" });

  const measureLatency = useCallback(async () => {
    setPing({ status: "checking" });
    const startedAt = performance.now();

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));

      if (error || !data) {
        setPing({ status: "error" });
        return;
      }

      setPing({ status: "ok", latencyMs });
    } catch {
      setPing({ status: "error" });
    }
  }, [authUserId]);

  useEffect(() => {
    const initialPingId = window.setTimeout(() => void measureLatency(), 0);
    const intervalId = window.setInterval(() => void measureLatency(), 30_000);
    return () => {
      window.clearTimeout(initialPingId);
      window.clearInterval(intervalId);
    };
  }, [measureLatency]);

  const label = ping.status === "checking"
    ? "Banco: medindo…"
    : ping.status === "ok"
      ? `Banco: ${ping.latencyMs} ms`
      : "Banco indisponível";
  const color = ping.status === "ok"
    ? "text-[#315b3c]"
    : ping.status === "error"
      ? "text-[#8d3c32]"
      : "text-[#718276]";

  return (
    <button
      aria-label={`${label}. Clique para medir novamente.`}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border border-[#d9e2d8] bg-white px-2.5 text-xs font-medium transition hover:bg-[#f5f7f2] disabled:cursor-wait disabled:opacity-70 sm:px-3 ${color}`}
      disabled={ping.status === "checking"}
      onClick={() => void measureLatency()}
      title="Tempo de ida e volta de uma consulta autenticada ao Supabase, medido no navegador. Atualiza a cada 30 segundos."
      type="button"
    >
      <span aria-hidden="true" className="text-sm">↻</span>
      <span aria-live="polite">{label}</span>
    </button>
  );
}
