import React from "react";
import { Select, Field, type SelectProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

const OPTIONS = [
  { label: "Evet", value: "true" },
  { label: "Hayır", value: "false" },
];

export interface YesNoFieldProps
  extends Omit<SelectProps, "value" | "onValueChange" | "children"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  isRequired?: boolean;
}

export function YesNoField({
  label,
  description,
  errorMessage,
  isRequired,
  disabled,
  placeholder = "Seçiniz",
  className,
  ...props
}: YesNoFieldProps) {
  const field = useFieldContext<boolean>();
  const error = getFieldError(field, errorMessage);
  const isDisabled = disabled ?? field.state.meta.isValidating;

  const currentValue =
    field.state.value === true
      ? "true"
      : field.state.value === false
        ? "false"
        : undefined;

  const control = (
    <Select
      value={currentValue}
      onValueChange={(value) => field.handleChange(value === "true")}
      disabled={isDisabled}
      placeholder={placeholder}
      {...props}
    >
      {OPTIONS.map((option) => (
        <Select.Item
          key={option.value}
          value={option.value}
          label={option.label}
        />
      ))}
    </Select>
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

export default YesNoField;
