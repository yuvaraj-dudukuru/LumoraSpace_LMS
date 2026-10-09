import type { PaymentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getPaymentsForAdmin } from "@/lib/queries/payments";
import { csvResponse } from "@/lib/csv";

const STATUSES: PaymentStatus[] = ["SUCCESSFUL", "PENDING", "FAILED", "REFUNDED"];

/** "Export Data" on /admin/payments — the same status/search filter as the
 * table, as a CSV download. */
export async function GET(request: Request): Promise<Response> {
  await requireRole("ADMIN");

  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status");
  const status = STATUSES.find((value) => value === statusParam) ?? "all";
  const search = params.get("search")?.trim() || undefined;

  const rows = await getPaymentsForAdmin({ status, search });

  return csvResponse("payments", [
    ["Transaction", "Order ID", "Learner", "Email", "Program", "Amount", "Currency", "Method", "Date", "Status"],
    ...rows.map((row) => [
      row.transactionRef,
      row.orderId,
      row.learnerName,
      row.learnerEmail,
      row.programName ?? "",
      row.amount.toFixed(2),
      row.currency,
      row.method,
      row.createdAt.toISOString(),
      row.status,
    ]),
  ]);
}
