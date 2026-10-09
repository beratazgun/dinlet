import React from "react";
import { Select, Field, type SelectProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps<T extends string | number = string>
  extends Omit<SelectProps, "value" | "onValueChange" | "children"> {
  options: SelectOption<T>[];
  label?: string;
  description?: string;
  errorMessage?: string;
  isRequired?: boolean;
  value?: T;
  onValueChange?: (value: T) => void;
}

export function SelectField<T extends string | number = string>({
  options,
  label,
  description,
  errorMessage,
  isRequired,
  disabled,
  placeholder = "Seçiniz",
  className,
  value: _val,
  onValueChange: _onValChange,
  ...props
}: SelectFieldProps<T>) {
  const field = useFieldContext<T>();
  const error = getFieldError(field, errorMessage);
  const isDisabled = disabled ?? field.state.meta.isValidating;

  const currentValue =
    field.state.value !== undefined && field.state.value !== null
      ? String(field.state.value)
      : undefined;

  const handleSelect = (val: string) => {
    if (typeof field.state.value === "number") {
      const num = Number(val);
      field.handleChange((isNaN(num) ? val : num) as T);
    } else {
      field.handleChange(val as T);
    }
  };

  const selectControl = (
    <Select
      value={currentValue}
      onValueChange={handleSelect}
      disabled={isDisabled}
      placeholder={placeholder}
      {...props}
    >
      {options.map((option) => (
        <Select.Item
          key={String(option.value)}
          value={String(option.value)}
          label={option.label}
          disabled={option.disabled}
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
        {selectControl}
        {error ? (
          <Field.Error errors={[error]} />
        ) : description ? (
          <Field.Description>{description}</Field.Description>
        ) : null}
      </Field>
    );
  }

  return selectControl;
}

export default SelectField;
