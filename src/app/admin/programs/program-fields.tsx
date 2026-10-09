import type { ProgramFormat, ProgramLevel } from "@prisma/client";
import { FieldRow, SelectField, TextAreaField, TextField } from "@/components/admin/fields";

type ProgramValues = {
  name: string;
  slug: string;
  description: string;
  level: ProgramLevel;
  durationWeeks: number;
  format: ProgramFormat;
  credentialType: string | null;
  price: number | null;
};

/** The fields shared by Create Program and Edit Program. */
export function ProgramFields({ program }: { program?: ProgramValues }) {
  return (
    <>
      <TextField name="name" label="Program name" required maxLength={120} defaultValue={program?.name} />
      <TextField
        name="slug"
        label="URL slug"
        required
        maxLength={80}
        placeholder="forge-data-analyst"
        hint="Lowercase letters, numbers and hyphens. The public page lives at /programs/<slug>."
        defaultValue={program?.slug}
      />
      <TextAreaField name="description" label="Description" required rows={4} maxLength={2000} defaultValue={program?.description} />
      <FieldRow>
        <SelectField
          name="level"
          label="Level"
          required
          defaultValue={program?.level ?? "BEGINNER"}
          options={[
            { value: "BEGINNER", label: "Beginner" },
            { value: "INTERMEDIATE", label: "Intermediate" },
            { value: "ADVANCED", label: "Advanced" },
          ]}
        />
        <TextField name="durationWeeks" label="Duration (weeks)" type="number" required min={1} max={104} defaultValue={program?.durationWeeks} />
      </FieldRow>
      <FieldRow>
        <SelectField
          name="format"
          label="Format"
          required
          defaultValue={program?.format ?? "ONLINE"}
          options={[
            { value: "ONLINE", label: "Online" },
            { value: "HYBRID", label: "Hybrid" },
          ]}
        />
        <TextField
          name="price"
          label="Price"
          type="number"
          min={0}
          step="0.01"
          hint="Shown on the public page. Leave empty for “Contact us”."
          defaultValue={program?.price ?? undefined}
        />
      </FieldRow>
      <TextField
        name="credentialType"
        label="Credential"
        maxLength={80}
        placeholder="Professional Certificate"
        defaultValue={program?.credentialType ?? undefined}
      />
    </>
  );
}
