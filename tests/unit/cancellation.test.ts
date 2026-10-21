import { describe, expect, it } from "vitest";
import { computeRefund } from "@/lib/cancellation";

const policy = {
  tiers: [
    { min_hours_before: 72, refund_bps: 9000 },
    { min_hours_before: 24, refund_bps: 5000 },
    { min_hours_before: 0, refund_bps: 0 },
  ],
};
const start = new Date("2030-01-10T06:00:00+05:30");
const hoursBefore = (h: number) => new Date(start.getTime() - h * 3_600_000);

describe("computeRefund", () => {
  it.each([
    [100, 9000, 321_300],
    [72, 9000, 321_300],
    [48, 5000, 178_500],
    [24, 5000, 178_500],
    [10, 0, 0],
  ])("%i hours before → %i bps", (hours, bps, amount) => {
    const r = computeRefund({ policy, status: "confirmed", startAt: start, now: hoursBefore(hours), amountPaidPaise: 357_000, amountRefundedPaise: 0 });
    expect(r.can_cancel).toBe(true);
    expect(r.refund_bps).toBe(bps);
    expect(r.refundable_paise).toBe(amount);
  });

  it("only refunds what has not already been refunded", () => {
    const r = computeRefund({ policy, status: "confirmed", startAt: start, now: hoursBefore(100), amountPaidPaise: 100_000, amountRefundedPaise: 40_000 });
    expect(r.refundable_paise).toBe(54_000);
  });

  it("does not allow cancelling after the trip started or for terminal statuses", () => {
    expect(computeRefund({ policy, status: "confirmed", startAt: start, now: hoursBefore(-1), amountPaidPaise: 1, amountRefundedPaise: 0 }).can_cancel).toBe(false);
    for (const status of ["in_progress", "completed", "cancelled", "refunded", "refund_pending"]) {
      expect(computeRefund({ policy, status, startAt: start, now: hoursBefore(100), amountPaidPaise: 1, amountRefundedPaise: 0 }).can_cancel).toBe(false);
    }
  });

  it("is independent of tier order and clamps bad configuration", () => {
    const shuffled = { tiers: [policy.tiers[2], { min_hours_before: 72, refund_bps: 20_000 }, policy.tiers[1]] };
    const r = computeRefund({ policy: shuffled, status: "assigned", startAt: start, now: hoursBefore(80), amountPaidPaise: 1000, amountRefundedPaise: 0 });
    expect(r.refund_bps).toBe(10_000);
    expect(r.refundable_paise).toBe(1000);
  });
});
