import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth/profile";
import { readProcessorLink } from "@/lib/inventory/processor-link-prefill";

export async function POST(request: Request) {
  await requireAdminProfile();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_000) return Response.json({ error: "Requisição grande demais." }, { status: 413 });

  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Envie um link válido." }, { status: 400 });
  const decoder = new TextDecoder();
  let bodyText = "";
  let bodyBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyBytes += value.byteLength;
      if (bodyBytes > 4_000) {
        await reader.cancel();
        return Response.json({ error: "Requisição grande demais." }, { status: 413 });
      }
      bodyText += decoder.decode(value, { stream: true });
    }
    bodyText += decoder.decode();
  } catch {
    return Response.json({ error: "Envie um link válido." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return Response.json({ error: "Envie um link válido." }, { status: 400 });
  }
  const parsed = z.object({ url: z.string().trim().url().max(2_000) }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "Informe o link oficial de um processador." }, { status: 400 });

  try {
    return Response.json(await readProcessorLink(parsed.data.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ler a página do processador.";
    return Response.json({ error: message }, { status: 422 });
  }
}
