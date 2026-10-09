"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { refundPaymentSchema } from "@/lib/validations/admin";
import { notifyAdmins, NOTIFICATION_TYPE } from "@/lib/notifications";
import { transactionRef } from "@/lib/queries/payments";

export type PaymentActionResult = { ok: true } | { ok: false; error: string };

/** Record-keeping only: the gateway is stubbed (schema.prisma), so this moves
 * no money and deliberately leaves the learner's Enrollment untouched —
 * suspending access is its own action on /admin/enrollments. */
export async function refundPayment(id: string, input: { reason: string }): Promise<PaymentActionResult> {
  const admin = await requireRole("ADMIN");

  const parsed = refundPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "A reason is required." };

  const payment = await prisma.payment.findUnique({ where: { id }, select: { status: true, orderId: true } });
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.status === "REFUNDED") return { ok: true }; // idempotent
  if (payment.status !== "SUCCESSFUL") return { ok: false, error: "Only a successful payment can be refunded." };

  const refundedAt = new Date();
  const refunded = await prisma.$transaction(async (tx) => {
    // Filtered on SUCCESSFUL so two admins clicking at once write one event, not two.
    const updated = await tx.payment.updateMany({
      where: { id, status: "SUCCESSFUL" },
      data: { status: "REFUNDED", refundedAt },
    });
    if (updated.count === 0) return false;
    await tx.paymentEvent.create({
      data: {
        paymentId: id,
        eventType: "REFUNDED",
        description: `Refund recorded: ${parsed.data.reason}`,
        occurredAt: refundedAt,
      },
    });
    return true;
  });

  revalidatePath(`/admin/payments/${id}`);
  revalidatePath("/admin/payments");

  // So the other admins see it too. Never throws (notifications.ts).
  if (refunded) {
    await notifyAdmins({
      type: NOTIFICATION_TYPE.PAYMENT_REFUNDED,
      title: `Payment ${transactionRef(payment.orderId)} was marked refunded`,
      body: `Recorded by ${admin.name}. Reason: ${parsed.data.reason}`,
      actionUrl: `/admin/payments/${id}`,
    });
    revalidatePath("/admin", "layout");
  }
  return { ok: true };
}
