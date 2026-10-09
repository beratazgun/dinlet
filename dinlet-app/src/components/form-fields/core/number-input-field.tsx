import React from "react";
import { NumberInput, type NumberInputProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface NumberInputFieldProps
  extends Omit<NumberInputProps, "value" | "onValueChange"> {
  value?: number;
  onValueChange?: (value: number) => void;
}

export function NumberInputField({
  errorMessage,
  disabled,
  ...props
}: NumberInputFieldProps) {
  const field = useFieldContext<number>();
  const error = getFieldError(field, errorMessage);

  return (
    <NumberInput
      value={field.state.value ?? 0}
      onValueChange={(val) => field.handleChange(val)}
      errorMessage={error}
      disabled={disabled ?? field.state.meta.isValidating}
      {...props}
    />
  );
}

export default NumberInputField;
