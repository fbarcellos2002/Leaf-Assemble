import { NextRequest, NextResponse } from "next/server";

import { requireAdminProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function looksLikeBrandSearch(term: string) {
  const tokens = normalize(term).split(/\s+/).filter(Boolean);
  return tokens.length === 1 && !/\d/.test(term);
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
    const tokens = [...new Set(normalize(term).split(/\s+/).filter((token) => token.length >= 2))];
    if (tokens.length === 0) {
      return NextResponse.json({ results: [], needsMoreInput: true }, { headers: { "Cache-Control": "no-store" } });
    }

    let query = supabase
      .from("icecat_catalog")
      .select("icecat_id, supplier_name, product_code, model_name, category_id, image_url")
      .order("model_name")
      .limit(100);
    for (const token of tokens) query = query.ilike("search_text", `%${escapeLike(token)}%`);
    const { data, error } = await query;

    if (error) {
      console.error("Icecat catalog search failed", { code: error.code });
      return NextResponse.json({ error: "catalog-unavailable" }, { status: 503 });
    }

    const normalizedQuery = normalize(term);
    const rank = (item: { supplier_name: string; product_code: string; model_name: string }) => {
      const brand = normalize(item.supplier_name);
      const model = normalize(item.model_name);
      const code = normalize(item.product_code);
      return (model.startsWith(normalizedQuery) ? 12 : model.includes(normalizedQuery) ? 8 : 0)
        + (code.startsWith(normalizedQuery) ? 10 : code.includes(normalizedQuery) ? 7 : 0)
        + tokens.reduce((score, token) => score + (model.includes(token) ? 3 : 0) + (code.includes(token) ? 3 : 0) + (brand.includes(token) ? 1 : 0), 0);
    };
    const results = (data ?? [])
      .filter((item) => {
        const searchableText = [item.supplier_name, item.model_name, item.product_code].map(normalize);
        return tokens.every((token) => searchableText.some((value) => value.includes(token)));
      })
      .sort((left, right) => rank(right) - rank(left) || left.model_name.localeCompare(right.model_name))
      .slice(0, 12);

    if (results.length === 0 && looksLikeBrandSearch(term)) {
      const { data: matchingBrands, error: brandError } = await supabase
        .from("icecat_catalog")
        .select("supplier_name")
        .ilike("supplier_name", `%${escapeLike(term)}%`)
        .limit(1);
      if (brandError) {
        console.error("Icecat brand search failed", { code: brandError.code });
        return NextResponse.json({ error: "catalog-unavailable" }, { status: 503 });
      }

      if (!matchingBrands?.length) {
        return NextResponse.json({ results: [], notFound: "brand" }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    return NextResponse.json({
      results: results.map((item) => ({
        icecatId: String(item.icecat_id),
        supplierName: item.supplier_name,
        productCode: item.product_code,
        modelName: item.model_name,
        categoryId: item.category_id,
        imageUrl: item.image_url,
      })),
      notFound: results.length === 0 ? "product" : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Icecat catalog search failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "catalog-unavailable" }, { status: 503 });
  }
}
