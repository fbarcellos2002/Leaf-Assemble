import { evaluateCompatibility, type CompatibilityPart } from "@/lib/compatibility/engine";
import { componentCategories, type ComponentCategory } from "@/lib/inventory/specs";

export type InventoryPool = CompatibilityPart & {
  lots: Array<{
    id: string;
    lotCode: string | null;
    available: number;
  }>;
};

type StockOption = CompatibilityPart & {
  resourceKey: string;
  available: number;
  purchased: boolean;
};

type BuildBundle = {
  parts: StockOption[];
  resources: string[];
  status: "compatible" | "warning";
  missingCategory?: ComponentCategory;
};

export type CapacityResult = {
  compatibleBuilds: number;
  buildsNow: number;
  buildsWithPurchases: number | null;
  additionalWithPurchases: number | null;
  purchasesByCategory: Partial<Record<ComponentCategory, number>>;
  onePartAwayBuilds: number;
  onePartAwayByCategory: Partial<Record<ComponentCategory, number>>;
  missingCatalogCategories: ComponentCategory[];
  bottleneck: ComponentCategory | null;
  uncertainCombinations: number;
  searchExact: boolean;
  searchLimitReached: boolean;
};

const requiredCategories: ComponentCategory[] = [
  "CPU",
  "MOTHERBOARD",
  "RAM",
  "STORAGE",
  "PSU",
  "CASE",
];
const MAX_BUILDS = 500;
const MAX_BUNDLE_CANDIDATES = 8_000;
const MAX_SEARCH_NODES = 75_000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function option(part: InventoryPool, lotId: string, available: number, purchased: boolean): StockOption {
  return {
    id: part.id,
    lotId,
    category: part.category,
    manufacturer: part.manufacturer,
    name: part.name,
    model: part.model,
    description: part.description,
    specs: asRecord(part.specs),
    resourceKey: `${purchased ? "purchase" : "lot"}:${lotId}`,
    available: Math.min(available, MAX_BUILDS),
    purchased,
  };
}

function isDiscreteGraphicsRequired(cpu: StockOption) {
  return cpu.specs.integratedGraphics !== true;
}

function enumerateBundles(optionsByCategory: Map<ComponentCategory, StockOption[]>) {
  const bundles: BuildBundle[] = [];
  let uncertainCombinations = 0;
  let candidateLimitReached = false;
  let visited = 0;

  for (const cpu of optionsByCategory.get("CPU") ?? []) {
    const cpuNeedsGpu = isDiscreteGraphicsRequired(cpu);
    const gpuOptions = cpuNeedsGpu ? optionsByCategory.get("GPU") ?? [] : [undefined];
    if (cpuNeedsGpu && gpuOptions.length === 0) continue;

    for (const motherboard of optionsByCategory.get("MOTHERBOARD") ?? []) {
      const firstChecks = evaluateCompatibility([cpu, motherboard]);
      if (firstChecks.status === "incompatible") continue;
      for (const ram of optionsByCategory.get("RAM") ?? []) {
        const secondChecks = evaluateCompatibility([cpu, motherboard, ram]);
        if (secondChecks.status === "incompatible") continue;
        for (const storage of optionsByCategory.get("STORAGE") ?? []) {
          const thirdChecks = evaluateCompatibility([cpu, motherboard, ram, storage]);
          if (thirdChecks.status === "incompatible") continue;
          for (const psu of optionsByCategory.get("PSU") ?? []) {
            for (const pcCase of optionsByCategory.get("CASE") ?? []) {
              for (const gpu of gpuOptions) {
                visited += 1;
                if (visited > MAX_BUNDLE_CANDIDATES) {
                  candidateLimitReached = true;
                  break;
                }
                const parts = [cpu, motherboard, ram, storage, psu, pcCase, ...(gpu ? [gpu] : [])];
                const compatibility = evaluateCompatibility(parts);
                if (compatibility.status === "incompatible") continue;
                if (compatibility.status === "unknown") {
                  uncertainCombinations += 1;
                  continue;
                }
                bundles.push({
                  parts,
                  resources: parts.map((part) => part.resourceKey),
                  status: compatibility.status,
                });
              }
              if (candidateLimitReached) break;
            }
            if (candidateLimitReached) break;
          }
          if (candidateLimitReached) break;
        }
        if (candidateLimitReached) break;
      }
      if (candidateLimitReached) break;
    }
    if (candidateLimitReached) break;
  }

  const distinct = new Map<string, BuildBundle>();
  for (const bundle of bundles) {
    const key = [...bundle.resources].sort().join("|");
    const existing = distinct.get(key);
    if (!existing || (bundle.status === "compatible" && existing.status === "warning")) {
      distinct.set(key, bundle);
    }
  }
  const ranked = [...distinct.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "compatible" ? -1 : 1;
    const aLimit = Math.min(...a.parts.map((part) => part.available));
    const bLimit = Math.min(...b.parts.map((part) => part.available));
    return aLimit - bLimit;
  });
  return { bundles: ranked, uncertainCombinations, candidateLimitReached };
}

function enumerateOnePartAway(
  optionsByCategory: Map<ComponentCategory, StockOption[]>,
  missingPartOptions: Map<ComponentCategory, StockOption[]>,
) {
  const bundles: BuildBundle[] = [];
  let visited = 0;
  let candidateLimitReached = false;
  let uncertainCombinations = 0;

  for (const missingCategory of [...requiredCategories, "GPU" as const]) {
    const includedCategories = requiredCategories.filter((category) => category !== missingCategory);
    const chosen: StockOption[] = [];
    const visit = (index: number) => {
      if (candidateLimitReached) return;
      if (index === includedCategories.length) {
        const missingChoices = missingPartOptions.get(missingCategory) ?? [];
        for (const missingPart of missingChoices) {
          const candidateCpu = missingCategory === "CPU" ? missingPart : chosen.find((part) => part.category === "CPU");
          const needsGpu = candidateCpu ? isDiscreteGraphicsRequired(candidateCpu) : false;
          if (missingCategory === "GPU" && !needsGpu) continue;
          const gpuChoices: Array<StockOption | undefined> = needsGpu
            ? missingCategory === "GPU" ? [undefined] : optionsByCategory.get("GPU") ?? []
            : [undefined];
          for (const gpu of gpuChoices) {
            visited += 1;
            if (visited > MAX_BUNDLE_CANDIDATES) {
              candidateLimitReached = true;
              return;
            }
            const validationParts = [...chosen, missingPart, ...(gpu ? [gpu] : [])];
            const compatibility = evaluateCompatibility(validationParts);
            if (compatibility.status !== "compatible") {
              if (compatibility.status === "unknown") uncertainCombinations += 1;
              continue;
            }
            // The missing part is used only to validate whether this partial set
            // has a real compatible completion; only the remaining physical units
            // are reserved in the one-part-away packing plan.
            bundles.push({
              parts: chosen,
              resources: chosen.map((part) => part.resourceKey),
              status: "compatible",
              missingCategory,
            });
          }
        }
        return;
      }
      const category = includedCategories[index];
      for (const part of optionsByCategory.get(category) ?? []) {
        chosen.push(part);
        visit(index + 1);
        chosen.pop();
        if (candidateLimitReached) return;
      }
    };
    visit(0);
  }

  const distinct = new Map<string, BuildBundle>();
  for (const bundle of bundles) {
    const key = `${bundle.missingCategory}:${[...bundle.resources].sort().join("|")}`;
    if (!distinct.has(key)) distinct.set(key, bundle);
  }
  return { bundles: [...distinct.values()], uncertainCombinations, candidateLimitReached };
}

function optimizeBundles(
  bundles: BuildBundle[],
  initialResources: Map<string, number>,
  maxBuilds: number,
  minimumRequiredParts = requiredCategories.length,
) {
  const categoriesByResource = new Map<string, ComponentCategory>();
  for (const bundle of bundles) {
    for (const part of bundle.parts) categoriesByResource.set(part.resourceKey, part.category);
  }

  let best: BuildBundle[] = [];
  let nodes = 0;
  let searchLimitReached = false;
  const remaining = new Map(initialResources);

  // A fast feasible plan gives branch-and-bound a useful lower bound.
  const greedyRemaining = new Map(initialResources);
  const greedy: BuildBundle[] = [];
  for (let round = 0; round < maxBuilds; round += 1) {
    const candidate = bundles.find((bundle) => bundle.resources.every((key) => (greedyRemaining.get(key) ?? 0) > 0));
    if (!candidate) break;
    for (const key of candidate.resources) greedyRemaining.set(key, (greedyRemaining.get(key) ?? 0) - 1);
    greedy.push(candidate);
  }
  best = greedy;

  const upperBound = (count: number) => {
    const byCategory = new Map<ComponentCategory, number>();
    for (const [key, quantity] of remaining) {
      const category = categoriesByResource.get(key);
      if (category && requiredCategories.includes(category)) {
        byCategory.set(category, (byCategory.get(category) ?? 0) + quantity);
      }
    }
    const categoryBound = minimumRequiredParts === requiredCategories.length
      ? Math.min(...requiredCategories.map((category) => byCategory.get(category) ?? 0))
      : Math.floor(requiredCategories.reduce((sum, category) => sum + (byCategory.get(category) ?? 0), 0) / minimumRequiredParts);
    return Math.min(maxBuilds, count + categoryBound);
  };

  const search = (start: number, plan: BuildBundle[]) => {
    nodes += 1;
    if (plan.length > best.length) best = [...plan];
    if (best.length >= maxBuilds || nodes >= MAX_SEARCH_NODES) {
      searchLimitReached ||= nodes >= MAX_SEARCH_NODES;
      return;
    }
    if (upperBound(plan.length) <= best.length) return;

    for (let index = start; index < bundles.length; index += 1) {
      const bundle = bundles[index];
      if (!bundle.resources.every((key) => (remaining.get(key) ?? 0) > 0)) continue;
      for (const key of bundle.resources) remaining.set(key, (remaining.get(key) ?? 0) - 1);
      plan.push(bundle);
      search(index, plan);
      plan.pop();
      for (const key of bundle.resources) remaining.set(key, (remaining.get(key) ?? 0) + 1);
      if (searchLimitReached || best.length >= maxBuilds) return;
    }
  };

  search(0, []);
  return { plan: best, exact: !searchLimitReached, searchLimitReached, nodes };
}

export function calculateBuildCapacity(inventory: InventoryPool[]): CapacityResult {
  const partsByCategory = new Map<ComponentCategory, InventoryPool[]>();
  for (const category of componentCategories) partsByCategory.set(category, []);
  for (const part of inventory) partsByCategory.get(part.category)?.push(part);

  const stockTotals = new Map<ComponentCategory, number>();
  for (const category of requiredCategories) {
    stockTotals.set(category, (partsByCategory.get(category) ?? []).reduce(
      (sum, part) => sum + part.lots.reduce((lotSum, lot) => lotSum + Math.max(0, lot.available), 0),
      0,
    ));
  }

  const physicalOptions = new Map<ComponentCategory, StockOption[]>();
  for (const category of componentCategories) {
    physicalOptions.set(category, (partsByCategory.get(category) ?? []).flatMap((part) =>
      part.lots.filter((lot) => lot.available > 0).map((lot) => option(part, lot.id, lot.available, false)),
    ));
  }

  const currentOptions = [...physicalOptions.values()].flat();
  const currentResources = new Map(currentOptions.map((item) => [item.resourceKey, item.available]));
  const currentEnumeration = enumerateBundles(physicalOptions);
  const greenBundles = currentEnumeration.bundles.filter((bundle) => bundle.status === "compatible");
  const compatiblePlan = optimizeBundles(greenBundles, currentResources, MAX_BUILDS);
  const currentPlan = optimizeBundles(currentEnumeration.bundles, currentResources, MAX_BUILDS);

  const remainingOptions = new Map<ComponentCategory, StockOption[]>();
  const remainingResources = new Map<string, number>();
  for (const category of componentCategories) {
    remainingOptions.set(category, (physicalOptions.get(category) ?? []).flatMap((part) => {
      const available = Math.max(0, part.available - compatiblePlan.plan.filter((bundle) => bundle.resources.includes(part.resourceKey)).length);
      if (available <= 0) return [];
      remainingResources.set(part.resourceKey, available);
      return [{ ...part, available }];
    }));
  }
  const missingPartOptions = new Map<ComponentCategory, StockOption[]>();
  for (const category of [...requiredCategories, "GPU" as const]) {
    missingPartOptions.set(category, (partsByCategory.get(category) ?? []).map((part) =>
      option(part, `missing-${part.id}`, 1, true),
    ));
  }
  const nearEnumeration = enumerateOnePartAway(remainingOptions, missingPartOptions);
  const nearPlan = optimizeBundles(nearEnumeration.bundles, remainingResources, MAX_BUILDS, requiredCategories.length - 1);
  const onePartAwayByCategory: Partial<Record<ComponentCategory, number>> = {};
  for (const bundle of nearPlan.plan) {
    const category = bundle.missingCategory;
    if (category) onePartAwayByCategory[category] = (onePartAwayByCategory[category] ?? 0) + 1;
  }

  const catalogComplete = requiredCategories.every((category) => (partsByCategory.get(category)?.length ?? 0) > 0);
  const purchaseBound = catalogComplete ? MAX_BUILDS : 0;

  let purchasePlan = currentPlan;
  let purchaseEnumeration = currentEnumeration;
  if (catalogComplete && purchaseBound > 0) {
    const purchasableOptions = new Map<ComponentCategory, StockOption[]>();
    for (const category of componentCategories) {
      const physical = physicalOptions.get(category) ?? [];
      const virtual = (partsByCategory.get(category) ?? []).map((part) =>
        option(part, `purchase-${part.id}`, purchaseBound, true),
      );
      purchasableOptions.set(category, [...physical, ...virtual]);
    }
    const purchasableParts = [...purchasableOptions.values()].flat();
    const purchasableResources = new Map(purchasableParts.map((item) => [item.resourceKey, item.available]));
    purchaseEnumeration = enumerateBundles(purchasableOptions);
    purchasePlan = optimizeBundles(purchaseEnumeration.bundles, purchasableResources, purchaseBound);
  }

  const buildsNow = currentPlan.plan.length;
  const buildsWithPurchases = catalogComplete && purchaseBound > 0
    ? Math.min(purchaseBound, purchasePlan.plan.length)
    : null;
  const purchasesByCategory: Partial<Record<ComponentCategory, number>> = {};
  if (buildsWithPurchases !== null) {
    for (const bundle of purchasePlan.plan.slice(0, buildsWithPurchases)) {
      for (const part of bundle.parts) {
        if (part.purchased) purchasesByCategory[part.category] = (purchasesByCategory[part.category] ?? 0) + 1;
      }
    }
  }

  const usedByCategory = new Map<ComponentCategory, number>();
  for (const bundle of currentPlan.plan) {
    for (const part of bundle.parts) usedByCategory.set(part.category, (usedByCategory.get(part.category) ?? 0) + 1);
  }
  const bottleneck = currentPlan.plan.length
    ? requiredCategories
      .map((category) => ({
        category,
        slack: (stockTotals.get(category) ?? 0) - (usedByCategory.get(category) ?? 0),
      }))
      .sort((a, b) => a.slack - b.slack)[0]?.category ?? null
    : requiredCategories
      .map((category) => ({ category, total: stockTotals.get(category) ?? 0 }))
      .sort((a, b) => a.total - b.total)[0]?.category ?? null;

  return {
    compatibleBuilds: compatiblePlan.plan.length,
    buildsNow,
    buildsWithPurchases,
    additionalWithPurchases: buildsWithPurchases === null ? null : Math.max(0, buildsWithPurchases - buildsNow),
    purchasesByCategory,
    onePartAwayBuilds: nearPlan.plan.length,
    onePartAwayByCategory,
    missingCatalogCategories: requiredCategories.filter((category) => (partsByCategory.get(category)?.length ?? 0) === 0),
    bottleneck,
    uncertainCombinations: currentEnumeration.uncertainCombinations,
    searchExact: compatiblePlan.exact && currentPlan.exact && purchasePlan.exact && nearPlan.exact
      && !currentEnumeration.candidateLimitReached && !purchaseEnumeration.candidateLimitReached,
    searchLimitReached: compatiblePlan.searchLimitReached || currentPlan.searchLimitReached
      || purchasePlan.searchLimitReached || nearPlan.searchLimitReached || currentEnumeration.candidateLimitReached
      || purchaseEnumeration.candidateLimitReached || nearEnumeration.candidateLimitReached,
  };
}
