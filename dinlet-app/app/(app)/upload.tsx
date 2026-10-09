import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, InteractionManager, Pressable, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Bell, X } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { AuthButton, FormError } from "@/components/auth";
import { FileCard, ModeOption, PickFileCard, QuotaSheet } from "@/components/upload";
import { formatBytes } from "@/lib/format";
import {
  getApiErrorCode,
  getApiErrorMessage,
} from "@/lib/network-manager/api-error";
import { PDF_MIME_TYPE, uploadPdf, type PickedPdf } from "@/lib/upload/upload-pdf";
import type { PreflightApiResponse } from "@/networks/api/documents/documents";
import { deleteItemApi as deleteMediaApi } from "@/networks/api/media/media";
import { isAxiosError } from "axios";

type Preflight = NonNullable<PreflightApiResponse["Data"]>;
type RewriteMode = "FLUENT" | "RAW";

type Step =
  | { kind: "empty" }
  | { kind: "uploading"; file: PickedPdf; progress: number }
  | { kind: "checking"; file: PickedPdf }
  | { kind: "ready"; file: PickedPdf; preflight: Preflight }
  | { kind: "error"; file: PickedPdf; message: string };

const MAX_TITLE_LENGTH = 120;

const MODES: { id: RewriteMode; title: string; description: string; pro: boolean }[] = [
  {
    id: "FLUENT",
    title: "Akıcı anlatım",
    pro: true,
    description:
      "Maddeler bağlamlı cümlelere, tablolar anlatıma çevrilir. Her bölüm kısa bir tekrarla biter.",
  },
  {
    id: "RAW",
    title: "Düz okuma",
    pro: false,
    description:
      "Metin temizlenir ve notundaki sırayla okunur. Madde işaretleri ayrı cümle olur.",
  },
];

/**
 * Not yükleme: PDF seçilir ve hemen R2'ye yüklenir, ön kontrol sayfa
 * sayısını, kotaya etkisini ve okuma biçimi seçeneklerini getirir; "Sese
 * çevir" notu oluşturup işleme kuyruğuna alır.
 */
export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const subscription = useCraftQuery("subscription", "getMine");
  const preflightMutation = useCraftMutation("documents", "preflight");
  const createDocument = useCraftMutation("documents", "createDocument");
  const acceptConsents = useCraftMutation("users", "acceptConsents");

  const [step, setStep] = useState<Step>({ kind: "empty" });
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<RewriteMode>("RAW");
  const [formError, setFormError] = useState<string | null>(null);
  const [quotaSheetOpen, setQuotaSheetOpen] = useState(false);

  // Yüklenip not olmadan bırakılan dosya silinir; not oluşunca nota aittir.
  const pendingMediaId = useRef<number | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  const discardPendingMedia = useCallback(() => {
    uploadAbort.current?.abort();
    uploadAbort.current = null;
    const mediaId = pendingMediaId.current;
    pendingMediaId.current = null;
    if (mediaId) void deleteMediaApi({ id: mediaId }).catch(() => undefined);
  }, []);

  useEffect(() => discardPendingMedia, [discardPendingMedia]);

  const runPreflight = useCallback(
    async (file: PickedPdf, mediaId: number) => {
      setStep({ kind: "checking", file });
      try {
        const { data: preflight } = await preflightMutation.mutateAsync({ mediaId });
        setStep({ kind: "ready", file, preflight });
        setTitle((current) => current || preflight.suggestedTitle);
        setMode(preflight.fluent.available ? "FLUENT" : "RAW");
        if (!preflight.quota.enough) setQuotaSheetOpen(true);
      } catch (error) {
        setStep({ kind: "error", file, message: getApiErrorMessage(error) });
      }
    },
    [preflightMutation]
  );

  const startUpload = useCallback(
    async (file: PickedPdf) => {
      const controller = new AbortController();
      uploadAbort.current = controller;
      setStep({ kind: "uploading", file, progress: 0 });
      try {
        const mediaId = await uploadPdf(file, {
          signal: controller.signal,
          onProgress: (progress) => setStep({ kind: "uploading", file, progress }),
        });
        if (controller.signal.aborted) return;
        uploadAbort.current = null;
        pendingMediaId.current = mediaId;
        await runPreflight(file, mediaId);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStep({
          kind: "error",
          file,
          message: error instanceof Error && !isAxiosError(error)
            ? error.message
            : getApiErrorMessage(error),
        });
      }
    },
    [runPreflight]
  );

  const pickPdf = useCallback(async () => {
    setQuotaSheetOpen(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: PDF_MIME_TYPE,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    discardPendingMedia();
    setFormError(null);
    setTitle("");
    const file: PickedPdf = { uri: asset.uri, name: asset.name, size: asset.size ?? 0 };

    // Planın dosya sınırı yüklemeden önce denetlenir; büyük dosya boşuna gitmesin.
    const maxBytes = subscription.data?.data?.limits.maxFileBytes;
    if (maxBytes && file.size > maxBytes) {
      setStep({
        kind: "error",
        file,
        message: `Planında PDF en fazla ${formatBytes(maxBytes)} olabilir; bu dosya ${formatBytes(file.size)}.`,
      });
      return;
    }
    await startUpload(file);
  }, [discardPendingMedia, startUpload, subscription.data]);

  // Ekran açılınca doğrudan dosya seçici gelir.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => void pickPdf());
    return () => task.cancel();
    // Yalnızca ilk açılışta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function grantCrossBorderConsent() {
    if (step.kind !== "ready") return;
    try {
      // Zorunlu metinler bu adıma gelmeden onaylanmış durumda; aynı onay
      // yeni kayıtla yinelenir, yalnızca aktarım rızası değişir.
      await acceptConsents.mutateAsync({
        privacyNoticeAccepted: true,
        termsAccepted: true,
        crossBorderTransferConsent: true,
      });
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await runPreflight(step.file, step.preflight.mediaId);
      setMode("FLUENT");
    } catch (error) {
      Alert.alert("Rıza kaydedilemedi", getApiErrorMessage(error));
    }
  }

  function explainFluentBlock(blockedBy: Preflight["fluent"]["blockedBy"]) {
    if (blockedBy === "PLAN") {
      Alert.alert(
        "Akıcı anlatım Pro'ya özel",
        "Pro'da maddeler bağlamlı cümlelere, tablolar anlatıma çevrilir ve her bölüm kısa bir tekrarla biter. Bu not düz okunacak."
      );
      return;
    }
    Alert.alert(
      "Açık rıza gerekiyor",
      "Akıcı anlatım için notunun metni yurt dışındaki yapay zekâ servislerine (Google, Mistral, Anthropic) gönderilir. Rızanı dilediğin zaman geri çekebilirsin.",
      [
        {
          text: "Metni oku",
          onPress: () =>
            router.push({
              pathname: "/legal/[document]",
              params: { document: "cross-border-transfer" },
            }),
        },
        { text: "Vazgeç", style: "cancel" },
        { text: "Rıza veriyorum", onPress: () => void grantCrossBorderConsent() },
      ]
    );
  }

  function selectMode(next: RewriteMode) {
    if (step.kind !== "ready") return;
    if (next === "FLUENT" && !step.preflight.fluent.available) {
      explainFluentBlock(step.preflight.fluent.blockedBy);
      return;
    }
    setMode(next);
  }

  function openDocument(id: number) {
    router.replace({ pathname: "/documents/[id]", params: { id: String(id) } });
  }

  async function submit() {
    if (step.kind !== "ready") return;
    const { preflight } = step;
    setFormError(null);

    if (preflight.existingDocumentId) {
      // Aynı PDF zaten kütüphanede: yeni yüklenen kopyaya gerek yok.
      discardPendingMedia();
      openDocument(preflight.existingDocumentId);
      return;
    }
    if (!preflight.quota.enough) {
      setQuotaSheetOpen(true);
      return;
    }

    try {
      const response = await createDocument.mutateAsync({
        mediaId: preflight.mediaId,
        title: title.trim() || preflight.suggestedTitle,
        rewriteMode: mode,
      });
      pendingMediaId.current = null;
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
      openDocument(response.data.id);
    } catch (error) {
      const code = getApiErrorCode(error);
      if (isAxiosError(error) && error.response?.status === 402) {
        await runPreflight(step.file, preflight.mediaId);
        return;
      }
      if (code === "PRO_REQUIRED" || code === "CROSS_BORDER_CONSENT_REQUIRED") {
        setMode("RAW");
        explainFluentBlock(code === "PRO_REQUIRED" ? "PLAN" : "CONSENT");
        return;
      }
      setFormError(getApiErrorMessage(error));
    }
  }

  function close() {
    discardPendingMedia();
    router.back();
  }

  const preflight = step.kind === "ready" ? step.preflight : null;
  const fileDetail =
    step.kind === "uploading"
      ? `Yükleniyor… %${Math.round(step.progress * 100)}`
      : step.kind === "checking"
        ? "Sayfalar sayılıyor…"
        : preflight
          ? `${preflight.pageCount} sayfa · ${formatBytes(preflight.size)}`
          : "";
  const remainingAfter = preflight
    ? Math.max(0, preflight.quota.remainingPages - preflight.pageCount)
    : 0;

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 8, 34),
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={8}
            onPress={close}
            className="-ml-2.5 h-11 w-11 items-center justify-center"
          >
            <X size={24} strokeWidth={2} color="#0E1238" />
          </Pressable>
          <Text accessibilityRole="header" className="text-base font-bold text-brand-ink">
            Not yükle
          </Text>
          <View className="w-11" />
        </View>

        {step.kind === "empty" ? (
          <PickFileCard onPick={() => void pickPdf()} />
        ) : (
          <FileCard
            name={step.file.name}
            detail={fileDetail}
            progress={step.kind === "uploading" ? step.progress : undefined}
            busy={step.kind === "uploading" || step.kind === "checking"}
            error={step.kind === "error" ? step.message : null}
            onChange={() => void pickPdf()}
          />
        )}

        {preflight ? (
          <>
            {preflight.existingDocumentId ? (
              <View className="mt-4 rounded-2xl bg-brand-lavender p-3.5">
                <Text className="text-[13px] leading-[19px] text-brand-body">
                  Bu PDF'i daha önce yüklemişsin. Sayfa hakkından tekrar düşülmez;
                  mevcut notu açabilirsin.
                </Text>
              </View>
            ) : (
              <>
                <Text className="mt-5 text-sm font-semibold text-brand-ink">Başlık</Text>
                <TextInput
                  accessibilityLabel="Başlık"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder={preflight.suggestedTitle}
                  placeholderTextColor="#8A8FAD"
                  returnKeyType="done"
                  className="mt-1.5 h-[52px] rounded-[14px] border-[1.5px] border-brand-line bg-white px-4 font-medium text-[16px] text-brand-ink"
                />

                <Text className="mb-2 mt-[22px] text-sm font-semibold text-brand-ink">
                  Nasıl okunsun?
                </Text>
                <View accessibilityRole="radiogroup" accessibilityLabel="Okuma biçimi" className="gap-2.5">
                  {MODES.map((option) => (
                    <ModeOption
                      key={option.id}
                      title={option.title}
                      description={option.description}
                      pro={option.pro}
                      selected={mode === option.id}
                      locked={option.id === "FLUENT" && !preflight.fluent.available}
                      onPress={() => selectMode(option.id)}
                    />
                  ))}
                </View>

                <View className="mt-[18px] gap-2.5 rounded-2xl bg-brand-lavender p-3.5">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-brand-ink-soft">Bu yükleme</Text>
                    <Text className="text-sm font-bold text-brand-ink">
                      {preflight.pageCount} sayfa
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-brand-ink-soft">Bu ay kalan</Text>
                    <Text
                      className={`text-sm font-bold ${preflight.quota.enough ? "text-brand-ink" : "text-brand-danger"}`}
                    >
                      {preflight.quota.enough
                        ? `${preflight.quota.remainingPages} → ${remainingAfter} sayfa`
                        : `${preflight.quota.remainingPages} sayfa · yetmiyor`}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </>
        ) : null}

        {formError ? (
          <View className="mt-4">
            <FormError>{formError}</FormError>
          </View>
        ) : null}

        <View className="min-h-6 flex-1" />

        <View className="mb-3.5 flex-row items-start gap-2">
          <Bell size={18} strokeWidth={2} color="#2D40E5" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[13px] leading-[19px] text-brand-ink-soft">
            İşlem arka planda sürer; uygulamayı kapatabilirsin. Bitince bildirim gelir.
          </Text>
        </View>
        <AuthButton
          disabled={step.kind !== "ready"}
          loading={createDocument.isPending || acceptConsents.isPending}
          onPress={() => void submit()}
        >
          {preflight?.existingDocumentId ? "Notu aç" : "Sese çevir"}
        </AuthButton>
        <Text className="mt-3 text-center text-xs text-brand-muted">
          Devam ederek bu içeriğe hakkın olduğunu onaylarsın.
        </Text>
      </KeyboardAwareScrollView>

      {preflight ? (
        <QuotaSheet
          visible={quotaSheetOpen}
          pageCount={preflight.pageCount}
          usedPages={preflight.quota.usedPages}
          remainingPages={preflight.quota.remainingPages}
          monthlyPages={preflight.quota.monthlyPages}
          resetsAt={preflight.quota.resetsAt.display}
          proMonthlyPages={preflight.proMonthlyPages}
          isPro={preflight.plan?.raw === "PRO"}
          onUpgrade={() => {
            setQuotaSheetOpen(false);
            router.push("/pro");
          }}
          onPickShorter={() => void pickPdf()}
          onClose={() => setQuotaSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}
