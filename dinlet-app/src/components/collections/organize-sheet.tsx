import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Check, Plus, Star } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { AuthButton, FormError } from "@/components/auth";
import { BottomPanel } from "@/components/ui/bottom-panel";
import { SwitchToggle } from "@/components/ui/switch-toggle";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { FolderGlyph } from "./folder-glyph";
import { FolderSheet } from "./folder-sheet";
import { NameSheet } from "./name-sheet";

export interface OrganizableDocument {
  id: number;
  title: string;
  folderId: number | null;
  isFavorite: boolean;
  tags: { id: number; name: string }[];
}

/** Notu düzenle: klasöre taşı, favorilere ekle, etiketle. */
export function OrganizeSheet({
  visible,
  document,
  onClose,
}: {
  visible: boolean;
  document: OrganizableDocument;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const collections = useCraftQuery("study", "getCollections", [], { enabled: visible });
  const updateDocument = useCraftMutation("documents", "rename");
  const setTags = useCraftMutation("study", "setDocumentTags");
  const createTag = useCraftMutation("study", "createTag");

  const [folderId, setFolderId] = useState<number | null>(document.folderId);
  const [isFavorite, setIsFavorite] = useState(document.isFavorite);
  const [tagIds, setTagIds] = useState<number[]>(document.tags.map((tag) => tag.id));
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFolderId(document.folderId);
    setIsFavorite(document.isFavorite);
    setTagIds(document.tags.map((tag) => tag.id));
    setError(null);
  }, [visible, document]);

  const folders = collections.data?.data?.folders ?? [];
  const tags = collections.data?.data?.tags ?? [];

  function toggleTag(id: number) {
    setTagIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id]
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateDocument.mutateAsync({
        params: { id: document.id },
        body: { folderId, isFavorite },
      });
      await setTags.mutateAsync({ params: { id: document.id }, body: { tagIds } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["collections"] }),
      ]);
      onClose();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomPanel visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text
          accessibilityRole="header"
          className="mt-[18px] font-display text-2xl tracking-[-0.48px] text-brand-ink"
        >
          Düzenle
        </Text>
        <Text numberOfLines={1} className="mt-1 text-sm text-brand-ink-soft">
          {document.title}
        </Text>

        <View className="mt-3 min-h-[54px] flex-row items-center justify-between border-b border-[#EEF0F7]">
          <View className="flex-row items-center gap-2.5">
            <Star size={20} color="#1928B4" fill={isFavorite ? "#1928B4" : "transparent"} />
            <Text className="text-[15px] font-semibold text-brand-ink">Favorilere ekle</Text>
          </View>
          <SwitchToggle
            accessibilityLabel="Favorilere ekle"
            value={isFavorite}
            onValueChange={setIsFavorite}
          />
        </View>

        <Text className="mb-1 mt-4 text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted">
          Klasör
        </Text>
        <View accessibilityRole="radiogroup">
          {[{ id: null, name: "Klasörsüz", color: "#D5D9EE" }, ...folders].map((folder) => {
            const selected = folderId === folder.id;
            return (
              <Pressable
                key={folder.id ?? "none"}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setFolderId(folder.id)}
                className="min-h-[50px] flex-row items-center gap-3 border-b border-[#EEF0F7]"
              >
                <FolderGlyph color={folder.color} scale={0.7} />
                <Text className="flex-1 text-[15px] font-medium text-brand-ink">{folder.name}</Text>
                {selected ? <Check size={20} strokeWidth={2.6} color="#1928B4" /> : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yeni klasör oluştur"
          onPress={() => setNewFolderOpen(true)}
          className="mt-2.5 min-h-[44px] flex-row items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#B7BCD6] px-3.5"
        >
          <Plus size={14} strokeWidth={2.6} color="#1928B4" />
          <Text className="text-sm font-semibold text-brand-indigo">Yeni klasör</Text>
        </Pressable>

        <Text className="mb-2 mt-4 text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted">
          Etiketler
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {tags.map((tag) => {
            const selected = tagIds.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleTag(tag.id)}
                className={`h-9 justify-center rounded-full border-[1.5px] px-3.5 ${
                  selected ? "border-brand-indigo bg-brand-indigo" : "border-brand-line bg-white"
                }`}
              >
                <Text className={`text-sm font-semibold ${selected ? "text-white" : "text-brand-body"}`}>
                  {tag.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yeni etiket"
            onPress={() => setNewTagOpen(true)}
            className="h-9 flex-row items-center gap-1 rounded-full border-[1.5px] border-dashed border-[#B7BCD6] px-3.5"
          >
            <Plus size={14} strokeWidth={2.6} color="#1928B4" />
            <Text className="text-sm font-semibold text-brand-indigo">Etiket</Text>
          </Pressable>
        </View>

        {error ? (
          <View className="mt-3">
            <FormError>{error}</FormError>
          </View>
        ) : null}

        <AuthButton className="mt-5" loading={saving} onPress={() => void save()}>
          Kaydet
        </AuthButton>
      </ScrollView>

      <FolderSheet
        visible={newFolderOpen}
        folder={null}
        onCreated={(id) => {
          setFolderId(id);
        }}
        onClose={() => setNewFolderOpen(false)}
      />

      <NameSheet
        visible={newTagOpen}
        title="Yeni etiket"
        placeholder="Örn. Zor konular"
        maxLength={30}
        submitLabel="Etiket oluştur"
        onSubmit={async (name) => {
          const created = await createTag.mutateAsync({ name });
          await collections.refetch();
          setTagIds((current) => [...current, created.data.id]);
        }}
        onClose={() => setNewTagOpen(false)}
      />
    </BottomPanel>
  );
}
