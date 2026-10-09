import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation } from "@tanstack-query-craft";
import { AuthButton, FormError } from "@/components/auth";
import { BottomPanel } from "@/components/ui/bottom-panel";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { StudyFolder } from "./folder-card";
import { FOLDER_COLORS, FolderGlyph } from "./folder-glyph";

type FolderColor = (typeof FOLDER_COLORS)[number];

function asFolderColor(value: string | undefined): FolderColor | undefined {
  return FOLDER_COLORS.find((option) => option === value);
}

/** Klasör oluşturma ve düzenleme: ad ve renk; düzenlerken silme. */
export function FolderSheet({
  visible,
  folder,
  onClose,
  onCreated,
}: {
  visible: boolean;
  /** Verilirse düzenleme, yoksa yeni klasör. */
  folder: StudyFolder | null;
  onClose: () => void;
  onCreated?: (folderId: number) => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const create = useCraftMutation("study", "createFolder");
  const update = useCraftMutation("study", "updateFolder");
  const remove = useCraftMutation("study", "removeFolder");
  const [name, setName] = useState("");
  const [color, setColor] = useState<FolderColor | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(folder?.name ?? "");
    setColor(asFolderColor(folder?.color));
    setError(null);
  }, [visible, folder]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["collections"] }),
      queryClient.invalidateQueries({ queryKey: ["documents"] }),
    ]);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Klasöre bir ad ver.");
      return;
    }
    setError(null);
    try {
      if (folder) {
        await update.mutateAsync({ params: { id: folder.id }, body: { name: trimmed, color } });
      } else {
        const res = await create.mutateAsync({ name: trimmed, color });
        await onCreated?.(res.data.id);
      }
      await refresh();
      onClose();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    }
  }

  function confirmRemove() {
    if (!folder) return;
    Alert.alert(
      "Klasörü sil",
      `"${folder.name}" silinecek. İçindeki ${folder.documentCount} not kütüphanende kalır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await remove.mutateAsync({ id: folder.id });
            await refresh();
            onClose();
          },
        },
      ]
    );
  }

  return (
    <BottomPanel visible={visible} onClose={onClose}>
      <Text
        accessibilityRole="header"
        className="mt-[18px] font-display text-2xl tracking-[-0.48px] text-brand-ink"
      >
        {folder ? "Klasörü düzenle" : "Yeni klasör"}
      </Text>

      <Text className="mt-4 text-sm font-semibold text-brand-ink">Ad</Text>
      <TextInput
        accessibilityLabel="Klasör adı"
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoFocus={!folder}
        placeholder="Örn. Tarih"
        placeholderTextColor="#8A8FAD"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        className="mt-1.5 h-12 rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-[15px] text-brand-ink"
      />

      <Text className="mt-4 text-sm font-semibold text-brand-ink">Renk</Text>
      <View accessibilityRole="radiogroup" className="mt-2 flex-row flex-wrap gap-2.5">
        {FOLDER_COLORS.map((option) => {
          const selected = (color ?? folder?.color) === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={`Renk ${option}`}
              accessibilityState={{ checked: selected }}
              onPress={() => setColor(option)}
              className={`h-12 w-12 items-center justify-center rounded-2xl border-2 ${
                selected ? "border-brand-ink" : "border-transparent"
              }`}
            >
              <FolderGlyph color={option} scale={0.85} />
              {selected ? (
                <View className="absolute">
                  <Check size={16} strokeWidth={3} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View className="mt-3">
          <FormError>{error}</FormError>
        </View>
      ) : null}

      <AuthButton
        className="mt-5"
        loading={create.isPending || update.isPending}
        onPress={() => void save()}
      >
        {folder ? "Kaydet" : "Klasör oluştur"}
      </AuthButton>
      {folder ? (
        <AuthButton variant="ghost" className="mt-1" onPress={confirmRemove}>
          Klasörü sil
        </AuthButton>
      ) : null}
    </BottomPanel>
  );
}
