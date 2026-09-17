import { forbidden } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { getUserDetailForAdmin, getAllBatchesForAdmin } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { RoleStatusControls } from "./role-status-controls";
import { MentorAssignmentForm } from "./mentor-assignment-form";
import { ResetPasswordForm } from "./reset-password-form";

const ACCESS_STATE_STYLES: Record<string, string> = {
  GRANTED: "bg-success-container text-success",
  SUSPENDED: "bg-error-container text-on-error-container",
  AWAITING: "bg-warning-container text-warning",
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireRole("ADMIN");
  const { userId } = await params;

  const user = await getUserDetailForAdmin(userId);
  if (!user) forbidden();

  const batchOptions = user.role === "MENTOR" ? await getAllBatchesForAdmin() : [];

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          {user.name}
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          {user.email} · Joined {formatDate(user.createdAt)}
        </p>
      </header>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-lg">
        <RoleStatusControls userId={user.id} role={user.role} status={user.status} />
      </section>

      {user.role === "MENTOR" ? (
        <MentorAssignmentForm mentorId={user.id} assignments={user.mentorAssignments} batchOptions={batchOptions} />
      ) : null}

      <section className="flex flex-col gap-md rounded-xl border border-outline-variant/40 bg-surface-container-low p-lg">
        <div>
          <h2 className="font-title-lg text-title-lg text-on-surface">Reset password</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            There is no self-service reset — this is how a locked-out user gets back in.
          </p>
        </div>
        <ResetPasswordForm userId={user.id} />
      </section>

      <section className="flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">Enrollments</h2>
        {user.enrollments.length === 0 ? (
          <p className="rounded-xl bg-surface-container-low p-lg font-body-md text-body-md text-on-surface-variant">
            No enrollments.
          </p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {user.enrollments.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-lg sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{enrollment.programName}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {enrollment.batchName ?? "—"} · {enrollment.status}
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <div className="flex w-24 flex-col gap-xs">
                    <span className="font-label-sm text-label-sm text-on-surface">
                      {enrollment.progressPercent}%
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${enrollment.progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-md py-xs font-label-sm text-label-sm ${ACCESS_STATE_STYLES[enrollment.accessState] ?? ""}`}
                  >
                    {enrollment.accessState}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
