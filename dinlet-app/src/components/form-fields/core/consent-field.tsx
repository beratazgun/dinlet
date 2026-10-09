import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface ConsentFieldProps {
  /** Metin; içinde bağlantı veya kalın parça olabilir. */
  children: ReactNode;
  /** Ekran okuyucu için düz metin karşılığı. */
  accessibilityLabel: string;
}

/**
 * KVKK onay satırı: 20px kare onay kutusu ve yanında metin. Satırın tamamı
 * dokunulabilir; metindeki bağlantılar kendi dokunuşlarını yakalar.
 */
export function ConsentField({ children, accessibilityLabel }: ConsentFieldProps) {
  const field = useFieldContext<boolean>();
  const checked = field.state.value === true;
  const error = getFieldError(field);

  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        onPress={() => {
          field.handleChange(!checked);
          field.handleBlur();
        }}
        className="flex-row items-start gap-3 py-2.5"
      >
        <View
          className={`mt-px h-5 w-5 items-center justify-center rounded-md border-[1.5px] ${
            checked
              ? "border-brand-indigo bg-brand-indigo"
              : error
                ? "border-brand-danger bg-white"
                : "border-[#B7BCD6] bg-white"
          }`}
        >
          {checked ? <Check size={14} strokeWidth={3} color="#FFFFFF" /> : null}
        </View>
        <Text className="flex-1 text-sm leading-[20px] text-brand-body">
          {children}
        </Text>
      </Pressable>
    </View>
  );
}

export default ConsentField;
