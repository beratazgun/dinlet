import React from "react";
import { Checkbox, type CheckboxProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";

export interface CheckboxFieldProps
  extends Omit<CheckboxProps, "checked" | "onCheckedChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function CheckboxField({ disabled, ...props }: CheckboxFieldProps) {
  const field = useFieldContext<boolean>();

  return (
    <Checkbox
      checked={field.state.value ?? false}
      onCheckedChange={(checked) => field.handleChange(checked === true)}
      disabled={disabled ?? field.state.meta.isValidating}
      {...props}
    />
  );
}

export default CheckboxField;
