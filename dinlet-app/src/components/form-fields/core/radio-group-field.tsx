import React from "react";
import { RadioGroup, Field, type RadioGroupProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface RadioGroupOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupFieldProps
  extends Omit<RadioGroupProps, "value" | "onValueChange" | "children"> {
  options: RadioGroupOption[];
  label?: string;
  description?: string;
  errorMessage?: string;
  isRequired?: boolean;
}

export function RadioGroupField({
  options,
  label,
  description,
  errorMessage,
  isRequired,
  disabled,
  className,
  ...props
}: RadioGroupFieldProps) {
  const field = useFieldContext<string>();
  const error = getFieldError(field, errorMessage);
  const isDisabled = disabled ?? field.state.meta.isValidating;

  const control = (
    <RadioGroup
      value={field.state.value ?? ""}
      onValueChange={(val) => field.handleChange(val)}
      disabled={isDisabled}
      {...props}
    >
      {options.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          label={opt.label}
          description={opt.description}
          disabled={opt.disabled}
        />
      ))}
    </RadioGroup>
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

export default RadioGroupField;
