import React, { useState } from "react";
import { Pressable, Text, View, type StyleProp, type TextStyle } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Input, type InputProps } from "panelui-native";
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useFieldContext } from "@/context/form-context";
import { getFieldError } from "./utils";

export interface AuthTextFieldProps extends Omit<
  InputProps,
  "value" | "onChangeText" | "label" | "size"
> {
  label: string;
  /** Kayıt ekranındaki biraz daha alçak (50px) alan. */
  compact?: boolean;
  /** Şifre alanı: gizli yazılır, göz ikonu ile gösterilir. */
  password?: boolean;
}

/**
 * Giriş / kayıt ekranlarının alanı: üstte yarı kalın etiket, beyaz zeminli
 * 14px köşeli kutu. Kenar rengi dinlenim durumunda belirgin sınır (#C5CAE3),
 * odak durumunda marka mavisi (#2D40E5), hata durumunda ise kırmızı (#D92D45)
 * animasyonla geçiş yapar.
 */
export function AuthTextField({
  label,
  compact = false,
  password = false,
  errorMessage,
  onFocus,
  onBlur,
  style,
  ...props
}: AuthTextFieldProps) {
  const field = useFieldContext<string>();
  const error = getFieldError(field, errorMessage);
  const [visible, setVisible] = useState(false);

  const focus = useSharedValue(0);
  const isInvalid = !!error;
  const idleColor = isInvalid ? "#D92D45" : "#C5CAE3";
  const activeColor = isInvalid ? "#D92D45" : "#2D40E5";

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [idleColor, activeColor]
    ),
  }), [idleColor, activeColor]);

  const handleFocus: typeof onFocus = (e) => {
    focus.value = withTiming(1, { duration: 150 });
    onFocus?.(e);
  };

  const handleBlur: typeof onBlur = (e) => {
    focus.value = withTiming(0, { duration: 150 });
    field.handleBlur();
    onBlur?.(e);
  };

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-brand-ink">{label}</Text>
      <Input
        nativeID={field.name}
        accessibilityLabel={label}
        value={field.state.value ?? ""}
        onChangeText={(text) => field.handleChange(text)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        errorMessage={error}
        secureTextEntry={password && !visible}
        placeholderTextColor="#8A8FAD"
        className={`${compact ? "h-[50px]" : "h-[52px]"} rounded-[14px] border-[1.5px] border-[#C5CAE3] bg-white px-4 text-[16px] text-brand-ink`}
        style={[animatedBorderStyle as unknown as StyleProp<TextStyle>, style]}
        endContent={
          password ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? "Şifreyi gizle" : "Şifreyi göster"}
              hitSlop={10}
              onPress={() => setVisible((value) => !value)}
            >
              {visible ? (
                <EyeOff size={20} color="#6B7090" />
              ) : (
                <Eye size={20} color="#6B7090" />
              )}
            </Pressable>
          ) : undefined
        }
        {...props}
      />
    </View>
  );
}

export default AuthTextField;
