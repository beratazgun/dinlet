import React from "react";
import { View } from "react-native";
import { Slider, Field, Text, type SliderProps } from "panelui-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface SliderFieldProps
  extends Omit<SliderProps, "value" | "onValueChange"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  showValue?: boolean;
  valueFormatter?: (val: number) => string;
  className?: string;
}

export function SliderField({
  label,
  description,
  errorMessage,
  showValue = true,
  valueFormatter,
  disabled,
  className,
  ...props
}: SliderFieldProps) {
  const field = useFieldContext<number>();
  const error = getFieldError(field, errorMessage);
  const isDisabled = disabled ?? field.state.meta.isValidating;
  const currentValue = field.state.value ?? 0;

  const control = (
    <Slider
      value={currentValue}
      onValueChange={(val) => field.handleChange(val)}
      disabled={isDisabled}
      {...props}
    />
  );

  return (
    <Field disabled={isDisabled} invalid={!!error} className={className}>
      {(label || showValue) && (
        <View className="flex-row items-center justify-between">
          {label && <Field.Label>{label}</Field.Label>}
          {showValue && (
            <Text size="sm" muted>
              {valueFormatter ? valueFormatter(currentValue) : String(currentValue)}
            </Text>
          )}
        </View>
      )}
      {control}
      {error ? (
        <Field.Error errors={[error]} />
      ) : description ? (
        <Field.Description>{description}</Field.Description>
      ) : null}
    </Field>
  );
}

export default SliderField;
