import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { AuthButton, FormError } from "@/components/auth";
import { BottomPanel } from "@/components/ui/bottom-panel";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";

/** Tek alanlı ad paneli (etiket oluşturma / yeniden adlandırma). */
export function NameSheet({
  visible,
  title,
  initialName = "",
  placeholder,
  maxLength,
  submitLabel,
  onSubmit,
  onDelete,
  onClose,
}: {
  visible: boolean;
  title: string;
  initialName?: string;
  placeholder: string;
  maxLength: number;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setError(null);
  }, [visible, initialName]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Bir ad yaz.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomPanel visible={visible} onClose={onClose}>
      <Text
        accessibilityRole="header"
        className="mt-[18px] font-display text-2xl tracking-[-0.48px] text-brand-ink"
      >
        {title}
      </Text>
      <TextInput
        accessibilityLabel={title}
        value={name}
        onChangeText={setName}
        maxLength={maxLength}
        autoFocus
        placeholder={placeholder}
        placeholderTextColor="#8A8FAD"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        className="mt-4 h-12 rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-[15px] text-brand-ink"
      />
      {error ? (
        <View className="mt-3">
          <FormError>{error}</FormError>
        </View>
      ) : null}
      <AuthButton className="mt-5" loading={saving} onPress={() => void submit()}>
        {submitLabel}
      </AuthButton>
      {onDelete ? (
        <AuthButton variant="ghost" className="mt-1" onPress={onDelete}>
          Sil
        </AuthButton>
      ) : null}
    </BottomPanel>
  );
}
