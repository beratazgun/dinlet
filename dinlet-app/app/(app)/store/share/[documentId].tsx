import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { StoreChip } from "@/components/store";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";

const MAX_CATEGORIES = 4;

/** Mağazada yazar adı: "Selin D." */
function creditPreview(name?: string | null, surname?: string | null): string {
  const first = name?.trim();
  const initial = surname?.trim().charAt(0).toLocaleUpperCase("tr-TR");
  if (!first) return "Dinlet kullanıcısı";
  return initial ? `${first} ${initial}.` : first;
}

/**
 * "Mağazada paylaş": kendi hazır notunu başlık, açıklama ve sınav/ders ile
 * incelemeye gönderir. Not zaten incelemede veya yayındaysa durumu gösterir.
 */
export default function ShareDocumentScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ documentId: string }>();
  const documentId = Number(params.documentId);

  const document = useCraftQuery("documents", "getDocument", [{ id: documentId }]);
  const me = useCraftQuery("auth", "getMe");
  const home = useCraftQuery("store", "home");
  const submissions = useCraftQuery("store", "listMine", [{ documentId }]);
  const submit = useCraftMutation("store", "submit");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (document.data?.data && !title) setTitle(document.data.data.title.slice(0, 100));
    // Başlık yalnızca ilk yüklemede nottan doldurulur.
  }, [document.data?.data]);

  const active = submissions.data?.data?.find(
    (row) => row.status?.raw === "PENDING" || row.status?.raw === "APPROVED"
  );
  const lastRejected = submissions.data?.data?.find((row) => row.status?.raw === "REJECTED");
  const exams = home.data?.data?.categories ?? [];
  const profile = me.data?.data;

  const toggleCategory = (id: number) =>
    setCategoryIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= MAX_CATEGORIES
          ? current
          : [...current, id]
    );

  const canSubmit =
    title.trim().length >= 4 &&
    description.trim().length >= 20 &&
    categoryIds.length > 0 &&
    confirmed;

  const send = () => {
    setError(null);
    submit.mutate(
      {
        documentId,
        title: title.trim(),
        description: description.trim(),
        categoryIds,
        confirmRights: true,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["store", "submissions"] });
          Alert.alert(
            "İncelemeye gönderildi",
            "Editörlerimiz notunu inceleyecek. Onaylanınca bildirim gelecek ve mağazada herkes ücretsiz dinleyebilecek.",
            [{ text: "Tamam", onPress: () => router.back() }]
          );
        },
        onError: (submitError) => setError(getApiErrorMessage(submitError)),
      }
    );
  };

  if (document.isPending || submissions.isPending || home.isPending) {
    return (
      <View
        className="flex-1 bg-brand-offwhite px-5"
        style={{ paddingTop: Math.max(insets.top + 8, 56) }}
      >
        <BackButton onPress={() => router.back()} />
        <View className="items-center py-24">
          <ActivityIndicator color="#1928B4" />
        </View>
      </View>
    );
  }

  if (active) {
    const approved = active.status?.raw === "APPROVED";
    return (
      <View
        className="flex-1 bg-brand-offwhite px-5"
        style={{ paddingTop: Math.max(insets.top + 8, 56) }}
      >
        <StatusBar style="dark" />
        <BackButton onPress={() => router.back()} />
        <Text
          accessibilityRole="header"
          className="mt-2 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
        >
          {approved ? "Notun mağazada" : "Notun incelemede"}
        </Text>
        <Text className="mt-1.5 text-sm leading-5 text-brand-ink-soft">
          {approved
            ? `“${active.title}” mağazada herkese ücretsiz açık. Kendi notunu değiştirsen veya silsen de mağazadaki sürüm aynı kalır.`
            : `“${active.title}” editörlerimizin incelemesini bekliyor. Sonuç bildirim olarak gelecek.`}
        </Text>
        <View className="mt-5 gap-2.5">
          {approved && active.storeItemId ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/store/items/[id]",
                  params: { id: String(active.storeItemId) },
                })
              }
              className="h-[52px] items-center justify-center rounded-2xl bg-brand-indigo"
            >
              <Text className="text-[15px] font-bold text-white">Mağazada gör</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/store/submissions")}
            className="h-[52px] items-center justify-center rounded-2xl bg-brand-lavender"
          >
            <Text className="text-[15px] font-bold text-brand-indigo">Paylaştıklarım</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: 150,
        }}
      >
        <BackButton onPress={() => router.back()} />
        <Text
          accessibilityRole="header"
          className="mt-2 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
        >
          Mağazada paylaş
        </Text>
        <Text className="mt-1 text-sm leading-5 text-brand-ink-soft">
          Notun editör onayından sonra mağazada herkese ücretsiz açılır. Sesler, sorular ve
          metin olduğu gibi paylaşılır.
        </Text>

        {lastRejected?.rejectionReason ? (
          <View className="mt-4 gap-1 rounded-2xl bg-[#FEF3F2] p-3.5">
            <Text className="text-[13px] font-bold text-[#B42318]">Önceki paylaşım onaylanmadı</Text>
            <Text className="text-[13px] leading-[19px] text-[#7A271A]">
              {lastRejected.rejectionReason}
            </Text>
          </View>
        ) : null}

        <Text className="mb-1.5 mt-5 text-sm font-semibold text-brand-ink">Başlık</Text>
        <TextInput
          accessibilityLabel="Başlık"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder="Örn. Osmanlı Kuruluş Dönemi özetim"
          placeholderTextColor="#8A8FAD"
          className="h-[50px] rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-[15px] text-brand-ink"
        />

        <Text className="mb-1.5 mt-4 text-sm font-semibold text-brand-ink">Açıklama</Text>
        <TextInput
          accessibilityLabel="Açıklama"
          value={description}
          onChangeText={setDescription}
          maxLength={600}
          multiline
          textAlignVertical="top"
          placeholder="Notta ne var, kimin işine yarar? (en az 20 karakter)"
          placeholderTextColor="#8A8FAD"
          className="min-h-[110px] rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 py-3 text-[15px] leading-[21px] text-brand-ink"
        />

        <Text className="mb-1 mt-4 text-sm font-semibold text-brand-ink">Sınav ve ders</Text>
        <Text className="mb-2 text-xs text-brand-muted">{`En fazla ${MAX_CATEGORIES} seçim.`}</Text>
        {exams.map((exam) => (
          <View key={exam.id} className="mb-2.5 flex-row flex-wrap gap-2">
            <StoreChip
              label={exam.name}
              selected={categoryIds.includes(exam.id)}
              onPress={() => toggleCategory(exam.id)}
            />
            {exam.children.map((subject) => (
              <StoreChip
                key={subject.id}
                label={subject.name}
                selected={categoryIds.includes(subject.id)}
                onPress={() => toggleCategory(subject.id)}
              />
            ))}
          </View>
        ))}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirmed }}
          onPress={() => setConfirmed((value) => !value)}
          className="mt-3 flex-row gap-3 rounded-2xl bg-brand-lavender p-3.5"
        >
          <View
            className="mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-md border-2"
            style={{
              borderColor: confirmed ? "#1928B4" : "#B7BCD6",
              backgroundColor: confirmed ? "#1928B4" : "#FFFFFF",
            }}
          >
            {confirmed ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
          <Text className="flex-1 text-[13px] leading-[19px] text-brand-body">
            Bu notun içeriği bana ait; bir kitaptan, yayınevinden veya başkasının ders notundan
            kopyalanmadı. Mağazada herkesin ücretsiz dinleyebilmesine ve adımın
            <Text className="font-bold">{` “${creditPreview(profile?.name, profile?.surname)}” `}</Text>
            olarak görünmesine rıza veriyorum.
          </Text>
        </Pressable>

        {error ? (
          <View className="mt-3">
            <FormError>{error}</FormError>
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 gap-2 border-t border-[#E9EBF5] bg-white px-5 pt-3.5"
        style={{ paddingBottom: Math.max(insets.bottom + 16, 32) }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit || submit.isPending}
          onPress={send}
          className="h-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: canSubmit ? "#1928B4" : "#B7BCD6" }}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-[17px] font-bold text-white">İncelemeye gönder</Text>
          )}
        </Pressable>
        <Text className="text-center text-xs text-brand-muted">
          Paylaşımı istediğin zaman “Paylaştıklarım”dan kaldırabilirsin.
        </Text>
      </View>
    </View>
  );
}
