import { useState } from "react";
import { ApiError } from "./api";

/** Minimal form state helper: values, per-field errors (from the API's `details`), and a submit wrapper. */
export function useForm<T extends Record<string, any>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof T>(k: K, v: T[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }));
  };
  /** Props for a text-like input bound to a field. */
  const bind = (k: keyof T & string) => ({
    value: (values[k] ?? "") as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as T[typeof k]),
    error: errors[k],
    name: k,
  });

  async function submit(fn: (v: T) => Promise<void>) {
    setBusy(true);
    setFormError(null);
    setErrors({});
    try {
      await fn(values);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.details) setErrors(e.details);
        setFormError(e.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return { values, setValues, set, bind, errors, setErrors, formError, setFormError, busy, submit };
}
