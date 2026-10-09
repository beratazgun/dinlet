import React from "react";
import { Textarea, type TextareaProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface TextareaFieldProps
  extends Omit<TextareaProps, "value" | "onChangeText"> {
  value?: string;
  onChangeText?: (text: string) => void;
}

export function TextareaField({
  errorMessage,
  disabled,
  ...props
}: TextareaFieldProps) {
  const field = useFieldContext<string>();
  const error = getFieldError(field, errorMessage);

  return (
    <Textarea
      nativeID={field.name}
      value={field.state.value ?? ""}
      onChangeText={(text) => field.handleChange(text)}
      onBlur={field.handleBlur}
      errorMessage={error}
      disabled={disabled ?? field.state.meta.isValidating}
      {...props}
    />
  );
}

export default TextareaField;
