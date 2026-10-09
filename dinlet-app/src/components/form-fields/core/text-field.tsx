import React from "react";
import { Input, type InputProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface TextFieldProps extends Omit<InputProps, "value" | "onChangeText"> {
  value?: string;
  onChangeText?: (text: string) => void;
}

export function TextField({ errorMessage, disabled, ...props }: TextFieldProps) {
  const field = useFieldContext<string>();
  const error = getFieldError(field, errorMessage);

  return (
    <Input
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

export default TextField;
