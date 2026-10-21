"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";

type RazorpayHandlerResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: string, cb: (r: { error: { description?: string } }) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Opens Razorpay Checkout for a pending booking; the server verifies the result. */
export function PayButton({ reference, label }: { reference: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);

  async function pay() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const order = (await res.json()) as {
        ok: boolean;
        error?: string;
        keyId: string;
        orderId: string;
        amount: number;
        currency: string;
        prefill: Record<string, string>;
      };
      if (!res.ok || !order.ok) {
        setMessage({ tone: "error", text: order.error ?? "Could not start payment." });
        setBusy(false);
        return;
      }
      if (!(await loadCheckout()) || !window.Razorpay) {
        setMessage({ tone: "error", text: "Could not load the payment window. Check your connection and try again." });
        setBusy(false);
        return;
      }
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Yatra Travel",
        description: `Booking ${reference}`,
        prefill: order.prefill,
        theme: { color: "#0f3d2e" },
        handler: async (response: RazorpayHandlerResponse) => {
          setMessage({ tone: "info", text: "Verifying your payment…" });
          try {
            const verify = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const result = (await verify.json()) as { ok: boolean; outcome?: string; error?: string };
            if (result.ok && (result.outcome === "confirmed" || result.outcome === "already_processed")) {
              setMessage({ tone: "success", text: "Payment received — your booking is confirmed." });
            } else if (result.ok && result.outcome === "refund_required") {
              setMessage({ tone: "info", text: "Payment received, but the vehicle is no longer available. A full refund has been queued and our team will contact you." });
            } else if (result.ok && result.outcome === "processing") {
              setMessage({ tone: "info", text: "Your payment is being processed. This page will update once the bank confirms it." });
            } else {
              setMessage({ tone: "error", text: result.error ?? "Payment could not be verified. If money was debited, it will be confirmed or refunded automatically." });
            }
          } catch {
            setMessage({ tone: "info", text: "We could not confirm the payment from your browser. If money was debited, your booking will update automatically within a few minutes." });
          } finally {
            setBusy(false);
            router.refresh();
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (r) => {
        setMessage({ tone: "error", text: r.error.description ?? "Payment failed. You can try again." });
        setBusy(false);
      });
      checkout.open();
    } catch {
      setMessage({ tone: "error", text: "Network error. Please try again." });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="gold" size="lg" onClick={pay} disabled={busy} className="w-full sm:w-auto">
        {busy ? "Opening secure payment…" : label}
      </Button>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}
