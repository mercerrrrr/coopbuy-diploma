/**
 * Helpers for Zod v4 errors (ZodError.issues, not .errors).
 */

/** Returns the first human-readable issue message, or a fallback. */
export function firstZodError(err) {
  if (err?.issues?.length > 0) return err.issues[0].message;
  return "Ошибка валидации.";
}

/** Returns { fieldName: "first message" } map from Zod issues. */
export function zodFieldErrors(err) {
  const result = {};
  if (!err?.issues) return result;
  for (const issue of err.issues) {
    const field = issue.path[0];
    if (field && !result[field]) result[field] = issue.message;
  }
  return result;
}
