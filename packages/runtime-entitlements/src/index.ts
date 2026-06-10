/*
 * @maataa/runtime-entitlements
 * Entitlement boundary + billing simulator.
 *
 * PHKD honesty:
 *   - ENFORCEMENT IS REAL & FAIL-CLOSED: consume() denies any request that would
 *     exceed a SKU's declared cap; unknown account/SKU is denied (never default-
 *     allow). This is the entitlement boundary — caps are *enforced*, not advisory.
 *   - The billing side is a SIMULATOR ONLY: simulateBill() is a deterministic cost
 *     projection in INR. It is NOT a charge, NOT connected to any payment network
 *     (UPI/Visa/Mastercard remain BLOCKED), and mints no license keys.
 *   - This package does NOT make SKUs "purchasable" (no checkout/provisioning);
 *     c-skus-purchasable stays BLOCKED. It defines a small catalog purely so the
 *     boundary has concrete caps to enforce.
 *   - Deterministic, in-memory core (a persistence adapter can be layered later).
 */

export type Resource = "seats" | "devices" | "storageBytes";

export interface SkuCaps {
  seats: number;
  devices: number;
  storageBytes: number;
}

export interface SkuPricing {
  /** Flat base fee per period (INR). */
  baseINR: number;
  /** Included is up to caps.seats; this prices each seat within the plan. */
  perSeatINR: number;
  /** Overage charge per GB of storage used BEYOND caps.storageBytes (INR/GB). */
  overagePerGBINR: number;
}

export interface Sku {
  id: string;
  name: string;
  caps: SkuCaps;
  pricing: SkuPricing;
  supportTier: "STANDARD" | "PRIORITY" | "ENTERPRISE";
}

const GB = 1024 * 1024 * 1024;

/** Small honest catalog — concrete caps for the boundary to enforce. */
export const SKUS: readonly Sku[] = Object.freeze([
  { id: "starter", name: "Starter", caps: { seats: 3, devices: 5, storageBytes: 5 * GB }, pricing: { baseINR: 0, perSeatINR: 0, overagePerGBINR: 20 }, supportTier: "STANDARD" },
  { id: "team", name: "Team", caps: { seats: 25, devices: 50, storageBytes: 100 * GB }, pricing: { baseINR: 4000, perSeatINR: 300, overagePerGBINR: 15 }, supportTier: "PRIORITY" },
  { id: "enterprise", name: "Enterprise", caps: { seats: 500, devices: 1500, storageBytes: 2000 * GB }, pricing: { baseINR: 60000, perSeatINR: 200, overagePerGBINR: 10 }, supportTier: "ENTERPRISE" },
]);

export const skuById = (id: string): Sku | undefined => SKUS.find((s) => s.id === id);

export interface Usage {
  seats: number;
  devices: number;
  storageBytes: number;
}
const ZERO_USAGE = (): Usage => ({ seats: 0, devices: 0, storageBytes: 0 });

export interface EntitlementDecision {
  allowed: boolean;
  accountId: string;
  resource: Resource;
  requested: number;
  current: number;
  limit: number;
  remaining: number;
  reason: string;
}

export interface QuotaMeter {
  accountId: string;
  skuId: string;
  caps: SkuCaps;
  usage: Usage;
  remaining: Usage;
  /** 0..1 utilization per resource (current/limit). */
  utilization: Record<Resource, number>;
}

interface Account {
  skuId: string;
  usage: Usage;
}

/** Enforces per-SKU caps. Fail-closed by construction. */
export class EntitlementRuntime {
  private accounts = new Map<string, Account>();

  /** Assign/replace an account's SKU. Unknown SKU is rejected (fail closed). */
  setSku(accountId: string, skuId: string): void {
    if (!skuById(skuId)) throw new Error(`unknown SKU '${skuId}' (fail closed)`);
    const existing = this.accounts.get(accountId);
    this.accounts.set(accountId, { skuId, usage: existing?.usage ?? ZERO_USAGE() });
  }

  getUsage(accountId: string): Usage {
    return { ...(this.accounts.get(accountId)?.usage ?? ZERO_USAGE()) };
  }

  private decide(accountId: string, resource: Resource, requested: number): EntitlementDecision {
    const acct = this.accounts.get(accountId);
    const sku = acct ? skuById(acct.skuId) : undefined;
    if (!acct || !sku) {
      return { allowed: false, accountId, resource, requested, current: 0, limit: 0, remaining: 0, reason: "no entitlement: account has no assigned SKU (fail closed)" };
    }
    if (!Number.isFinite(requested) || requested < 0) {
      return { allowed: false, accountId, resource, requested, current: acct.usage[resource], limit: sku.caps[resource], remaining: Math.max(0, sku.caps[resource] - acct.usage[resource]), reason: "invalid request amount (fail closed)" };
    }
    const current = acct.usage[resource];
    const limit = sku.caps[resource];
    const allowed = current + requested <= limit;
    return {
      allowed,
      accountId,
      resource,
      requested,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      reason: allowed ? "within cap" : `would exceed ${resource} cap (${current}+${requested} > ${limit})`,
    };
  }

  /** Non-mutating check: would consuming `amount` stay within cap? */
  check(accountId: string, resource: Resource, amount = 1): EntitlementDecision {
    return this.decide(accountId, resource, amount);
  }

  /** Enforced consume: mutates ONLY if within cap, else denies (fail closed). */
  consume(accountId: string, resource: Resource, amount = 1): EntitlementDecision {
    const decision = this.decide(accountId, resource, amount);
    if (decision.allowed) {
      const acct = this.accounts.get(accountId)!;
      acct.usage[resource] += amount;
      decision.current = acct.usage[resource] - amount;
      decision.remaining = Math.max(0, decision.limit - acct.usage[resource]);
    }
    return decision;
  }

  /** Release previously-consumed units (never below zero). */
  release(accountId: string, resource: Resource, amount = 1): void {
    const acct = this.accounts.get(accountId);
    if (!acct) return;
    acct.usage[resource] = Math.max(0, acct.usage[resource] - amount);
  }

  /** Quota meter: real utilization per resource. */
  meter(accountId: string): QuotaMeter {
    const acct = this.accounts.get(accountId);
    const sku = acct ? skuById(acct.skuId) : undefined;
    if (!acct || !sku) throw new Error(`no entitlement for account '${accountId}' (fail closed)`);
    const remaining: Usage = {
      seats: Math.max(0, sku.caps.seats - acct.usage.seats),
      devices: Math.max(0, sku.caps.devices - acct.usage.devices),
      storageBytes: Math.max(0, sku.caps.storageBytes - acct.usage.storageBytes),
    };
    const util = (cur: number, lim: number) => (lim === 0 ? 1 : Math.min(1, cur / lim));
    return {
      accountId,
      skuId: acct.skuId,
      caps: sku.caps,
      usage: { ...acct.usage },
      remaining,
      utilization: {
        seats: util(acct.usage.seats, sku.caps.seats),
        devices: util(acct.usage.devices, sku.caps.devices),
        storageBytes: util(acct.usage.storageBytes, sku.caps.storageBytes),
      },
    };
  }
}

// ── Billing simulator (deterministic; NOT a charge) ──────────────────────────

export interface BillingLine {
  label: string;
  qty: number;
  unitINR: number;
  amountINR: number;
}

export interface BillingSimulation {
  skuId: string;
  currency: "INR";
  lines: readonly BillingLine[];
  subtotalINR: number;
  /** Honesty markers. */
  simulationOnly: true;
  note: string;
}

/**
 * Deterministic cost projection for a SKU at a given usage level.
 * base + (billed seats × perSeat) + (storage overage GB × overagePerGB).
 * Billed seats are capped at the plan's seat cap (overage seats are not silently
 * billed — they would have been denied by the entitlement boundary).
 */
export function simulateBill(sku: Sku, usage: Usage): BillingSimulation {
  const billedSeats = Math.min(usage.seats, sku.caps.seats);
  const overageBytes = Math.max(0, usage.storageBytes - sku.caps.storageBytes);
  const overageGB = Math.ceil(overageBytes / GB);
  const lines: BillingLine[] = [
    { label: "Base plan", qty: 1, unitINR: sku.pricing.baseINR, amountINR: sku.pricing.baseINR },
    { label: "Seats", qty: billedSeats, unitINR: sku.pricing.perSeatINR, amountINR: billedSeats * sku.pricing.perSeatINR },
    { label: "Storage overage (GB)", qty: overageGB, unitINR: sku.pricing.overagePerGBINR, amountINR: overageGB * sku.pricing.overagePerGBINR },
  ];
  const subtotalINR = lines.reduce((sum, l) => sum + l.amountINR, 0);
  return {
    skuId: sku.id,
    currency: "INR",
    lines,
    subtotalINR,
    simulationOnly: true,
    note: "Deterministic simulation only — not a charge; no payment network; mints no license keys.",
  };
}

export default EntitlementRuntime;
