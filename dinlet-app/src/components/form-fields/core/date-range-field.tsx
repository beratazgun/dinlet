import React, { useMemo } from "react";
import {
  DatePicker,
  Field,
  type DatePickerProps,
  type DateRange,
} from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface DateRangeFieldValue {
  from?: Date | string;
  to?: Date | string;
}

export interface DateRangeFieldProps
  extends Omit<DatePickerProps<"range">, "selected" | "onSelect" | "mode"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  isRequired?: boolean;
}

export function DateRangeField({
  label,
  description,
  errorMessage,
  isRequired,
  disabled,
  placeholder = "Tarih aralığı seçiniz",
  className,
  ...props
}: DateRangeFieldProps) {
  const field = useFieldContext<DateRangeFieldValue | undefined>();
  const error = getFieldError(field, errorMessage);
  const isDisabled = disabled ?? field.state.meta.isValidating;

  const selectedRange = useMemo<DateRange | undefined>(() => {
    if (!field.state.value?.from) return undefined;

    const from =
      field.state.value.from instanceof Date
        ? field.state.value.from
        : new Date(field.state.value.from);

    if (isNaN(from.getTime())) return undefined;

    const to =
      field.state.value.to instanceof Date
        ? field.state.value.to
        : field.state.value.to
          ? new Date(field.state.value.to)
          : undefined;

    const validTo = to && !isNaN(to.getTime()) ? to : undefined;

    return { from, to: validTo };
  }, [field.state.value]);

  const handleSelect = (range: DateRange | undefined) => {
    field.handleChange(range);
  };

  const control = (
    <DatePicker
      mode="range"
      selected={selectedRange}
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

export default DateRangeField;
