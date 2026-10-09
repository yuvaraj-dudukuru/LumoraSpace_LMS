/** Uncontrolled form fields for ModalForm: the server page renders them with
 * a `name`, the browser collects them into FormData, the Server Action
 * validates with Zod. No client state per field. */

const CONTROL =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20";

function Wrapper({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={htmlFor} className="font-label-md text-label-md text-on-surface">
        {label}
      </label>
      {children}
      {hint ? <p className="font-label-sm text-label-sm text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

type Common = { name: string; label: string; hint?: string; required?: boolean };

export function TextField({
  name,
  label,
  hint,
  required,
  type = "text",
  defaultValue,
  placeholder,
  min,
  max,
  step,
  minLength,
  maxLength,
}: Common & {
  type?: "text" | "email" | "password" | "number" | "date" | "url";
  defaultValue?: string | number;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  minLength?: number;
  maxLength?: number;
}) {
  const id = `field-${name}`;
  return (
    <Wrapper label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        minLength={minLength}
        maxLength={maxLength}
        className={CONTROL}
      />
    </Wrapper>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  required,
  defaultValue,
  placeholder,
  rows = 4,
  maxLength,
}: Common & { defaultValue?: string; placeholder?: string; rows?: number; maxLength?: number }) {
  const id = `field-${name}`;
  return (
    <Wrapper label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={CONTROL}
      />
    </Wrapper>
  );
}

export function SelectField({
  name,
  label,
  hint,
  required,
  defaultValue,
  options,
  placeholder,
}: Common & { defaultValue?: string; options: { value: string; label: string }[]; placeholder?: string }) {
  const id = `field-${name}`;
  return (
    <Wrapper label={label} hint={hint} htmlFor={id}>
      <select id={id} name={name} required={required} defaultValue={defaultValue ?? ""} className={CONTROL}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function CheckboxField({ name, label, hint, defaultChecked }: Omit<Common, "required"> & { defaultChecked?: boolean }) {
  const id = `field-${name}`;
  return (
    <div className="flex items-start gap-sm">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-xs h-4 w-4 rounded-sm border-outline accent-primary"
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="font-label-md text-label-md text-on-surface">
          {label}
        </label>
        {hint ? <p className="font-label-sm text-label-sm text-on-surface-variant">{hint}</p> : null}
      </div>
    </div>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-md sm:grid-cols-2">{children}</div>;
}
