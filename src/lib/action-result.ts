/** What every admin Server Action returns. `redirectTo` lets a create action
 * send the caller to the new record (ModalForm pushes it); a plain
 * `{ ok: true }` just closes the dialog and lets revalidation refresh. */
export type ActionResult = { ok: true; redirectTo?: string } | { ok: false; error: string };

/** A FormData-taking Server Action, as ModalForm calls it. */
export type FormAction = (formData: FormData) => Promise<ActionResult>;
