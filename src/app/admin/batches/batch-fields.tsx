import type { Option } from "@/lib/queries/admin-options";
import { FieldRow, SelectField, TextField } from "@/components/admin/fields";
import { dateInputValue } from "@/components/admin/status";

type BatchValues = {
  programId: string;
  programName: string;
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  scheduleNote: string | null;
  capacity: number | null;
};

/** The fields shared by Create Batch and Edit Batch. When editing, the
 * program is shown but fixed (see updateBatch) — it is posted as a hidden
 * input so the same schema validates both forms. */
export function BatchFields({ programOptions, batch }: { programOptions: Option[]; batch?: BatchValues }) {
  return (
    <>
      {batch ? (
        <>
          <input type="hidden" name="programId" value={batch.programId} />
          <p className="font-label-md text-label-md text-on-surface-variant">
            Program: <span className="text-on-surface">{batch.programName}</span>
          </p>
        </>
      ) : (
        <SelectField name="programId" label="Program" required placeholder="Select a program" options={programOptions} />
      )}
      <FieldRow>
        <TextField name="name" label="Batch name" required maxLength={80} placeholder="Batch 05" defaultValue={batch?.name} />
        <TextField
          name="code"
          label="Code"
          required
          maxLength={20}
          placeholder="FDA-B05"
          hint="Unique. Letters, numbers and hyphens."
          defaultValue={batch?.code}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          name="startDate"
          label="Start date"
          type="date"
          required
          defaultValue={batch ? dateInputValue(batch.startDate) : undefined}
        />
        <TextField
          name="endDate"
          label="End date"
          type="date"
          required
          defaultValue={batch ? dateInputValue(batch.endDate) : undefined}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          name="scheduleNote"
          label="Schedule note"
          maxLength={120}
          placeholder="Mon, Wed, Fri • 18:00"
          defaultValue={batch?.scheduleNote ?? undefined}
        />
        <TextField
          name="capacity"
          label="Capacity"
          type="number"
          min={1}
          max={1000}
          hint="Leave empty for no limit."
          defaultValue={batch?.capacity ?? undefined}
        />
      </FieldRow>
    </>
  );
}
