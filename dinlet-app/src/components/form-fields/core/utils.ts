export function getFieldError(
  field: { state: { meta: { isTouched: boolean; errors: any[] } } },
  overrideError?: string
): string | undefined {
  if (overrideError) return overrideError;
  if (!field.state.meta.isTouched || !field.state.meta.errors?.length) {
    return undefined;
  }
  const first = field.state.meta.errors[0];
  if (!first) return undefined;
  return typeof first === "string" ? first : first.message ?? String(first);
}
