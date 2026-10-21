/**
 * Cancellation policy — refund amount depends on how long before the trip the
 * customer cancels. Tiers are configured in site_settings.cancellation_policy.
 */
export interface CancellationTier {
  min_hours_before: number;
  refund_bps: number; // 10000 = 100%
}

export interface CancellationPolicy {
  tiers: CancellationTier[];
  note?: string;
}

export interface RefundDecision {
  refundable_paise: number;
  refund_bps: number;
  hours_before: number;
  can_cancel: boolean;
  reason?: string;
}

const CANCELLABLE = new Set(["pending", "confirmed", "assigned"]);

export function computeRefund(params: {
  policy: CancellationPolicy;
  status: string;
  startAt: Date;
  now: Date;
  amountPaidPaise: number;
  amountRefundedPaise: number;
}): RefundDecision {
  const { policy, status, startAt, now, amountPaidPaise, amountRefundedPaise } = params;
  const hoursBefore = (startAt.getTime() - now.getTime()) / 3_600_000;

  if (!CANCELLABLE.has(status)) {
    return { refundable_paise: 0, refund_bps: 0, hours_before: hoursBefore, can_cancel: false, reason: "This booking can no longer be cancelled online." };
  }
  if (hoursBefore <= 0) {
    return { refundable_paise: 0, refund_bps: 0, hours_before: hoursBefore, can_cancel: false, reason: "The trip has already started. Please contact support." };
  }

  const remaining = Math.max(0, amountPaidPaise - amountRefundedPaise);
  const tier = [...policy.tiers]
    .sort((a, b) => b.min_hours_before - a.min_hours_before)
    .find((t) => hoursBefore >= t.min_hours_before);
  const bps = Math.max(0, Math.min(10_000, tier?.refund_bps ?? 0));
  return {
    refundable_paise: Math.floor((remaining * bps) / 10_000),
    refund_bps: bps,
    hours_before: hoursBefore,
    can_cancel: true,
  };
}
