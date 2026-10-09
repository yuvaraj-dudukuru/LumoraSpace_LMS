import type { PaymentStatus } from "@prisma/client";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  SUCCESSFUL: "Successful",
  PENDING: "Pending",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

const PILL_STYLE: Record<PaymentStatus, string> = {
  SUCCESSFUL: "bg-primary-fixed text-primary",
  PENDING: "bg-secondary-fixed text-secondary",
  FAILED: "bg-error-container text-on-error-container",
  REFUNDED: "bg-surface-container-high text-on-surface-variant",
};

const DOT_STYLE: Record<PaymentStatus, string> = {
  SUCCESSFUL: "bg-primary",
  PENDING: "bg-secondary",
  FAILED: "bg-error",
  REFUNDED: "bg-outline",
};

/** Left edge of the mobile transaction card (payments_mobile). */
export const PAYMENT_STATUS_EDGE: Record<PaymentStatus, string> = {
  SUCCESSFUL: "border-l-success",
  PENDING: "border-l-warning",
  FAILED: "border-l-error",
  REFUNDED: "border-l-outline",
};

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-xs whitespace-nowrap rounded-full px-sm py-xs font-label-sm text-label-sm ${PILL_STYLE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLE[status]}`} aria-hidden="true" />
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}
