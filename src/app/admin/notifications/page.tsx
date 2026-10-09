import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getNotificationsForUser, getUnreadNotificationCount, type NotificationFilter } from "@/lib/queries/notifications";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { ModalForm } from "@/components/admin/modal-form";
import { SelectField, TextAreaField, TextField } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/ui";
import { sendAnnouncement } from "./actions";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sent?: string }>;
}) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const filter: NotificationFilter = params.filter === "unread" ? "unread" : "all";
  const sent = Number.parseInt(params.sent ?? "", 10);

  const [items, unreadCount, programs, batches] = await Promise.all([
    getNotificationsForUser(user.id, filter),
    getUnreadNotificationCount(user.id),
    prisma.program.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.batch.findMany({
      where: { status: { in: ["UPCOMING", "ACTIVE"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, program: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Notifications" description="Alerts that need an admin, and announcements to learners.">
        <ModalForm
          trigger={
            <>
              <Megaphone className="h-4 w-4" /> Send Announcement
            </>
          }
          title="Send Announcement"
          description="Learners see this in their Notifications inbox. Nothing is emailed."
          submitLabel="Send"
          pendingLabel="Sending..."
          action={sendAnnouncement}
        >
          <SelectField
            name="audience"
            label="Send to"
            required
            defaultValue="all"
            options={[
              { value: "all", label: "All active learners" },
              { value: "program", label: "Learners in one program" },
              { value: "batch", label: "Learners in one batch" },
            ]}
          />
          <SelectField
            name="programId"
            label="Program"
            hint='Used when "Learners in one program" is chosen.'
            placeholder="— None —"
            options={programs.map((program) => ({ value: program.id, label: program.name }))}
          />
          <SelectField
            name="batchId"
            label="Batch"
            hint='Used when "Learners in one batch" is chosen. Upcoming and active batches only.'
            placeholder="— None —"
            options={batches.map((batch) => ({
              value: batch.id,
              label: `${batch.code} — ${batch.program.name}, ${batch.name}`,
            }))}
          />
          <TextField name="title" label="Title" required maxLength={120} />
          <TextAreaField name="body" label="Message" required rows={5} maxLength={2000} />
        </ModalForm>
      </PageHeader>

      {Number.isFinite(sent) && sent > 0 ? (
        <p role="status" className="rounded-lg bg-success-container px-md py-sm font-label-md text-label-md text-success">
          Announcement sent to {sent} learner{sent === 1 ? "" : "s"}.
        </p>
      ) : null}

      <NotificationInbox items={items} filter={filter} basePath="/admin/notifications" unreadCount={unreadCount} />
    </div>
  );
}
