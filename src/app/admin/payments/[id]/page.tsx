import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Activity, GraduationCap, LockOpen, Lock, User } from "lucide-react";
import type { AccessState, EnrollmentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getPaymentDetailForAdmin } from "@/lib/queries/payments";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { PaymentStatusPill } from "../payment-status";
import { RefundForm } from "./refund-form";

const EVENT_TITLE: Record<string, string> = {
  ORDER_CREATED: "Order Created",
  PAYMENT_INITIATED: "Payment Initiated",
  PAYMENT_SUCCESSFUL: "Payment Successful",
  PAYMENT_FAILED: "Payment Failed",
  ENROLLMENT_CREATED: "Enrollment Created",
  REFUNDED: "Refunded",
};

// The event that settled the payment's current state is the highlighted one.
const HIGHLIGHT_EVENT = new Set(["PAYMENT_SUCCESSFUL", "PAYMENT_FAILED", "REFUNDED"]);

const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
  DROPPED: "Dropped",
};

const ACCESS_LABEL: Record<AccessState, string> = {
  GRANTED: "Granted",
  AWAITING: "Awaiting",
  SUSPENDED: "Suspended",
};

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const payment = await getPaymentDetailForAdmin(id);
  if (!payment) notFound();

  const lastHighlight = [...payment.events].reverse().find((event) => HIGHLIGHT_EVENT.has(event.eventType));

  return (
    <div className="flex flex-col gap-xl">
      <Link
        href="/admin/payments"
        className="flex w-fit items-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Payments
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-md">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{payment.transactionRef}</h1>
            <PaymentStatusPill status={payment.status} />
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">Payment recorded via {payment.method}</p>
        </div>
        {payment.status === "SUCCESSFUL" ? <RefundForm paymentId={payment.id} /> : null}
      </header>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl lg:col-span-2">
          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-xl">
            <div className="flex flex-wrap items-center justify-between gap-md border-b border-outline-variant/40 pb-lg">
              <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
                {payment.status === "REFUNDED" ? "Amount Refunded" : "Amount Paid"}
              </span>
              <span className="font-display-lg-mobile text-display-lg-mobile text-primary lg:font-display-lg lg:text-display-lg">
                {formatMoney(payment.amount, payment.currency)}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-lg pt-lg md:grid-cols-4">
              <Detail label="Order ID" value={payment.orderId} />
              <Detail label="Date" value={formatDate(payment.createdAt)} />
              <Detail label="Method" value={payment.method} />
              <Detail label="Provider Ref" value={payment.providerRef ?? "—"} />
            </dl>
          </section>

          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-xl">
            <h2 className="flex items-center gap-sm font-headline-md text-headline-md text-on-surface">
              <Activity className="h-5 w-5 text-primary" /> Transaction Timeline
            </h2>
            {payment.events.length === 0 ? (
              <p className="mt-lg font-body-md text-body-md text-on-surface-variant">
                No events were recorded for this payment.
              </p>
            ) : (
              <ol className="mt-lg flex flex-col">
                {payment.events.map((event, index) => {
                  const highlighted = event.id === lastHighlight?.id;
                  const isLast = index === payment.events.length - 1;
                  return (
                    <li key={event.id} className="flex gap-md">
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-xs h-2.5 w-2.5 shrink-0 rounded-full ${highlighted ? "bg-primary" : "bg-outline-variant"}`}
                          aria-hidden="true"
                        />
                        {!isLast ? <span className="w-px flex-1 bg-outline-variant/60" aria-hidden="true" /> : null}
                      </div>
                      <div className={`flex flex-col gap-xs ${isLast ? "" : "pb-xl"}`}>
                        <p className={`font-label-md text-label-md ${highlighted ? "text-primary" : "text-on-surface"}`}>
                          {EVENT_TITLE[event.eventType] ?? event.eventType}
                        </p>
                        <p className="font-body-md text-body-md text-on-surface-variant">{event.description}</p>
                        <p className="font-label-sm text-label-sm text-on-surface">{formatDateTime(event.occurredAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-xl">
          <section className="flex flex-col gap-lg rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
            <h2 className="border-b border-outline-variant/40 pb-md font-title-lg text-title-lg text-on-surface">
              Learner Details
            </h2>
            <Link href={`/admin/users/${payment.learner.id}`} className="group flex items-center gap-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
                <User className="h-5 w-5 text-on-surface-variant" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-label-md text-label-md text-on-surface group-hover:underline">
                  {payment.learner.name}
                </span>
                <span className="truncate font-body-md text-body-md text-on-surface-variant">
                  {payment.learner.email}
                </span>
              </span>
            </Link>
            {payment.enrollment ? (
              <div className="flex items-center gap-sm rounded-xl bg-surface-container-low p-md">
                <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
                <span className="font-label-md text-label-md text-on-surface">{payment.enrollment.programName}</span>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-lg rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
            <h2 className="border-b border-outline-variant/40 pb-md font-title-lg text-title-lg text-on-surface">
              Enrollment Status
            </h2>
            {payment.enrollment ? (
              <>
                <dl className="flex flex-col gap-md">
                  <div className="flex items-center justify-between gap-md">
                    <dt className="font-body-md text-body-md text-on-surface-variant">Status</dt>
                    <dd className="rounded bg-surface-container-high px-sm py-xs font-label-sm text-label-sm text-on-surface">
                      {ENROLLMENT_STATUS_LABEL[payment.enrollment.status]}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-md">
                    <dt className="font-body-md text-body-md text-on-surface-variant">Access</dt>
                    <dd className="flex items-center gap-xs font-label-md text-label-md text-on-surface">
                      {payment.enrollment.accessState === "GRANTED" ? (
                        <LockOpen className="h-4 w-4 text-primary" />
                      ) : (
                        <Lock className="h-4 w-4 text-on-surface-variant" />
                      )}
                      {ACCESS_LABEL[payment.enrollment.accessState]}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/admin/enrollments?accessState=all&search=${encodeURIComponent(payment.learner.email)}`}
                  className="flex items-center justify-center gap-sm rounded-lg border border-outline px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
                >
                  View Enrollment <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant">
                This payment isn&apos;t linked to an enrollment.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-xs">
      <dt className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="truncate font-body-md text-body-md text-on-surface" title={value}>
        {value}
      </dd>
    </div>
  );
}
