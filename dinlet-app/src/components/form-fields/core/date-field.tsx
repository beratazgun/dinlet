import React, { useMemo } from "react";
import { DatePicker, Field, type DatePickerProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface DateFieldProps
  extends Omit<DatePickerProps<"single">, "selected" | "onSelect"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  isRequired?: boolean;
  /** Format for output when value is string. Defaults to 'YYYY-MM-DD'. */
  valueFormat?: "iso-date" | "iso-string" | "date";
}

export function DateField({
  label,
  description,
  errorMessage,
  isRequired,
  disabled,
  placeholder = "Tarih seçiniz",
  valueFormat = "iso-date",
  className,
  ...props
}: DateFieldProps) {
  const field = useFieldContext<string | Date | undefined>();
  const error = getFieldError(field, errorMessage);
  const isDisabled = disabled ?? field.state.meta.isValidating;

  const selectedDate = useMemo(() => {
    if (!field.state.value) return undefined;
    if (field.state.value instanceof Date) return field.state.value;
    const parsed = new Date(field.state.value);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }, [field.state.value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      field.handleChange(undefined);
      return;
    }
    if (valueFormat === "date" || field.state.value instanceof Date) {
      field.handleChange(date);
    } else if (valueFormat === "iso-string") {
      field.handleChange(date.toISOString());
    } else {
      // YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      field.handleChange(`${year}-${month}-${day}`);
    }
  };

  const control = (
    <DatePicker
      mode="single"
      selected={selectedDate}
      onSelect={handleSelect}
      disabled={isDisabled}
      placeholder={placeholder}
      {...props}
    />
  );

  if (label || description || error) {
    return (
      <Field
        disabled={isDisabled}
        invalid={!!error}
        required={isRequired}
        className={className}
      >
        {label && <Field.Label isRequired={isRequired}>{label}</Field.Label>}
        {control}
        {error ? (
          <Field.Error errors={[error]} />
        ) : description ? (
          <Field.Description>{description}</Field.Description>
        ) : null}
      </Field>
    );
  }

  return control;
}

export default DateField;
