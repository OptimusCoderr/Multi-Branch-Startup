export const emptyToUndefined = (val: unknown) =>
  val === "" || val === null || val === undefined ? undefined : val;
