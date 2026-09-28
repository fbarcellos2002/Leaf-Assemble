import { NextRequest, NextResponse } from "next/server";

import { requireAdminProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminProfile();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2048) return NextResponse.json({ error: "invalid-input" }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }
  const term = body && typeof body === "object" && "q" in body && typeof body.q === "string"
    ? body.q.trim()
    : "";
  if (term.length < 2 || term.length > 100) {
    return NextResponse.json({ results: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("icecat_catalog")
      .select("icecat_id, supplier_name, product_code, model_name, category_id, image_url")
      .ilike("search_text", `%${escapeLike(term)}%`)
      .order("model_name")
      .limit(12);

    if (error) return NextResponse.json({ error: "catalog-unavailable" }, { status: 503 });

    return NextResponse.json({
      results: (data ?? []).map((item) => ({
        icecatId: String(item.icecat_id),
        supplierName: item.supplier_name,
        productCode: item.product_code,
        modelName: item.model_name,
        categoryId: item.category_id,
        imageUrl: item.image_url,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "catalog-unavailable" }, { status: 503 });
  }
}
