import React from "react";
import { Input, type InputProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface PhoneTextFieldProps
  extends Omit<InputProps, "value" | "onChangeText"> {
  value?: string;
  onChangeText?: (text: string) => void;
}

export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  const limited = digits.slice(0, 10);

  let formatted = "";
  if (limited.length > 0) {
    formatted = limited.slice(0, 3);
  }
  if (limited.length > 3) {
    formatted += ` ${limited.slice(3, 6)}`;
  }
  if (limited.length > 6) {
    formatted += ` ${limited.slice(6, 8)}`;
  }
  if (limited.length > 8) {
    formatted += ` ${limited.slice(8, 10)}`;
  }

  return formatted;
}

export function PhoneTextField({
  errorMessage,
  disabled,
  placeholder = "5XX XXX XX XX",
  ...props
}: PhoneTextFieldProps) {
  const field = useFieldContext<string>();
  const error = getFieldError(field, errorMessage);

  return (
    <Input
      nativeID={field.name}
      keyboardType="phone-pad"
      placeholder={placeholder}
      maxLength={13}
      value={field.state.value ?? ""}
      onChangeText={(text) => {
        const formatted = formatPhoneNumber(text);
        field.handleChange(formatted);
      }}
      onBlur={field.handleBlur}
      errorMessage={error}
      disabled={disabled ?? field.state.meta.isValidating}
      {...props}
    />
  );
}

export default PhoneTextField;
