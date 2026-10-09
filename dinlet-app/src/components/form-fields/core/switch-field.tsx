import React from "react";
import { Switch, Field, type SwitchProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";

export interface SwitchFieldProps
  extends Omit<SwitchProps, "value" | "onValueChange"> {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}

export function SwitchField({
  label,
  description,
  disabled,
  className,
  ...props
}: SwitchFieldProps) {
  const field = useFieldContext<boolean>();
  const isDisabled = disabled ?? field.state.meta.isValidating;

  const control = (
    <Switch
      value={field.state.value ?? false}
      onValueChange={(val) => field.handleChange(val)}
      disabled={isDisabled}
      {...props}
    />
  );

  if (label || description) {
    return (
      <Field orientation="horizontal" disabled={isDisabled} className={className}>
        <Field.Content>
          {label && <Field.Title>{label}</Field.Title>}
          {description && <Field.Description>{description}</Field.Description>}
        </Field.Content>
        {control}
      </Field>
    );
  }

  return control;
}

export default SwitchField;
