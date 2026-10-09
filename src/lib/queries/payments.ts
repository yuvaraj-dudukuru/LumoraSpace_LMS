import "server-only";
import type { AccessState, EnrollmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** /admin/payments. Every caller is already requireRole(ADMIN)-gated, so
 * nothing here is scoped — same posture as queries/admin.ts. The gateway is
 * stubbed (schema.prisma): these rows are records, not a ledger of money
 * actually moved. */

export const PAYMENT_RANGE_DAYS = [7, 30, 90] as const;
export type PaymentRangeDays = (typeof PAYMENT_RANGE_DAYS)[number];

const DAY_MS = 86_400_000;
const DEFAULT_CURRENCY = "INR"; // Payment.currency's schema default

/** "ORD-2026-00124" → "TXN-2026-00124". There is no transaction-number
 * column; the label is the unique orderId under the design's prefix. */
export function transactionRef(orderId: string): string {
  return orderId.startsWith("ORD-") ? `TXN-${orderId.slice(4)}` : orderId;
}

export type PaymentStats = {
  /** Sum of SUCCESSFUL amounts created inside the range. */
  totalRevenue: number;
  currency: string;
  /** vs the equally long period just before; null when that period had no revenue. */
  revenueChangePercent: number | null;
  successfulCount: number;
  pendingCount: number;
  refundCount: number;
};

/** Amounts are summed as one currency (the newest payment's) — every row
 * uses the schema default today; a second currency needs per-currency totals. */
export async function getPaymentStats(rangeDays: PaymentRangeDays): Promise<PaymentStats> {
  const now = Date.now();
  const since = new Date(now - rangeDays * DAY_MS);
  const previousSince = new Date(now - 2 * rangeDays * DAY_MS);

  const [revenue, previousRevenue, counts, newest] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: since } }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { status: "SUCCESSFUL", createdAt: { gte: previousSince, lt: since } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.payment.findFirst({ orderBy: { createdAt: "desc" }, select: { currency: true } }),
  ]);

  const totalRevenue = Number(revenue._sum.amount ?? 0);
  const previousTotal = Number(previousRevenue._sum.amount ?? 0);
  const countFor = (status: PaymentStatus) => counts.find((row) => row.status === status)?._count._all ?? 0;

  return {
    totalRevenue,
    currency: newest?.currency ?? DEFAULT_CURRENCY,
    revenueChangePercent:
      previousTotal === 0 ? null : Math.round(((totalRevenue - previousTotal) / previousTotal) * 1000) / 10,
    successfulCount: countFor("SUCCESSFUL"),
    pendingCount: countFor("PENDING"),
    refundCount: countFor("REFUNDED"),
  };
}

export type AdminPaymentRow = {
  id: string;
  transactionRef: string;
  orderId: string;
  learnerName: string;
  learnerEmail: string;
  programName: string | null;
  amount: number;
  currency: string;
  method: string;
  status: PaymentStatus;
  createdAt: Date;
};

export type PaymentFilter = { status?: PaymentStatus | "all"; search?: string };

export async function getPaymentsForAdmin(filter: PaymentFilter = {}): Promise<AdminPaymentRow[]> {
  // The UI shows TXN-…; the column holds ORD-… — accept either spelling.
  const orderSearch = filter.search?.replace(/^txn-/i, "ORD-");
  const where: Prisma.PaymentWhereInput = {
    status: filter.status && filter.status !== "all" ? filter.status : undefined,
    ...(filter.search
      ? {
          OR: [
            { orderId: { contains: orderSearch, mode: "insensitive" } },
            { user: { name: { contains: filter.search, mode: "insensitive" } } },
            { user: { email: { contains: filter.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderId: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      enrollment: { select: { program: { select: { name: true } } } },
    },
  });

  return payments.map((payment) => ({
    id: payment.id,
    transactionRef: transactionRef(payment.orderId),
    orderId: payment.orderId,
    learnerName: payment.user.name,
    learnerEmail: payment.user.email,
    programName: payment.enrollment?.program.name ?? null,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    createdAt: payment.createdAt,
  }));
}

export type AdminPaymentDetail = {
  id: string;
  transactionRef: string;
  orderId: string;
  providerRef: string | null;
  amount: number;
  currency: string;
  method: string;
  status: PaymentStatus;
  createdAt: Date;
  refundedAt: Date | null;
  learner: { id: string; name: string; email: string };
  /** null when the payment was never linked to an enrollment. */
  enrollment: { id: string; status: EnrollmentStatus; accessState: AccessState; programName: string } | null;
  /** Oldest first. */
  events: { id: string; eventType: string; description: string; occurredAt: Date }[];
};

export async function getPaymentDetailForAdmin(id: string): Promise<AdminPaymentDetail | null> {
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: {
      id: true,
      orderId: true,
      providerRef: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      createdAt: true,
      refundedAt: true,
      user: { select: { id: true, name: true, email: true } },
      enrollment: { select: { id: true, status: true, accessState: true, program: { select: { name: true } } } },
      events: {
        orderBy: { occurredAt: "asc" },
        select: { id: true, eventType: true, description: true, occurredAt: true },
      },
    },
  });
  if (!payment) return null;

  return {
    id: payment.id,
    transactionRef: transactionRef(payment.orderId),
    orderId: payment.orderId,
    providerRef: payment.providerRef,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    createdAt: payment.createdAt,
    refundedAt: payment.refundedAt,
    learner: payment.user,
    enrollment: payment.enrollment
      ? {
          id: payment.enrollment.id,
          status: payment.enrollment.status,
          accessState: payment.enrollment.accessState,
          programName: payment.enrollment.program.name,
        }
      : null,
    events: payment.events,
  };
}
