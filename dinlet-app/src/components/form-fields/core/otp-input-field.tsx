import React from "react";
import { OtpInput, Field, type OtpInputProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface OtpInputFieldProps
  extends Omit<OtpInputProps, "value" | "onChangeText"> {
  value?: string;
  onChangeText?: (code: string) => void;
  label?: string;
  description?: string;
  isRequired?: boolean;
  className?: string;
}

export function OtpInputField({
  label,
  description,
  errorMessage,
  isRequired,
  disabled,
  className,
  ...props
}: OtpInputFieldProps) {
  const field = useFieldContext<string>();
  const error = getFieldError(field, errorMessage);
  const isDisabled = disabled ?? field.state.meta.isValidating;

  const control = (
    <OtpInput
      value={field.state.value ?? ""}
      onChangeText={(code) => field.handleChange(code)}
      disabled={isDisabled}
      errorMessage={error}
      {...props}
    />
  );

  if (label || description) {
    return (
      <Field
        disabled={isDisabled}
        invalid={!!error}
        required={isRequired}
        className={className}
      >
        {label && <Field.Label isRequired={isRequired}>{label}</Field.Label>}
        {control}
        {description && !error ? (
          <Field.Description>{description}</Field.Description>
        ) : null}
      </Field>
    );
  }

  return control;
}

export default OtpInputField;
