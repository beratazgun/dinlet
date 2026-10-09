import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Calendar } from "panelui-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation } from "@tanstack-query-craft";
import { AuthButton, FormError } from "@/components/auth";
import { BottomPanel } from "@/components/ui/bottom-panel";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { StudyGoal } from "./goal-card";

const EXAMS = ["KPSS", "YKS", "ALES", "DGS", "YDS", "LGS"];
const MAX_YEARS_AHEAD = 3;

/** Cihaz takvimindeki günü `YYYY-MM-DD` yapar (saat dilimi kaymadan). */
function toCalendarDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromCalendarDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, date);
}

/** Sınav hedefi: sınav adı ve günü; kayıtlı hedef kaldırılabilir. */
export function GoalSheet({
  visible,
  goal,
  onClose,
}: {
  visible: boolean;
  goal: StudyGoal | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const upsert = useCraftMutation("study", "upsertStudyGoal");
  const remove = useCraftMutation("study", "removeStudyGoal");
  const [examName, setExamName] = useState(goal?.examName ?? "KPSS");
  const [date, setDate] = useState<Date | undefined>(
    goal ? fromCalendarDay(goal.examDate) : undefined
  );
  const [error, setError] = useState<string | null>(null);

  // Panel her açılışta kayıtlı hedefle başlar.
  useEffect(() => {
    if (!visible) return;
    setExamName(goal?.examName ?? "KPSS");
    setDate(goal ? fromCalendarDay(goal.examDate) : undefined);
    setError(null);
  }, [visible, goal]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + MAX_YEARS_AHEAD);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["collections"] });
  }

  async function save() {
    if (!examName.trim() || !date) {
      setError("Sınav adını yaz ve takvimden günü seç.");
      return;
    }
    setError(null);
    try {
      await upsert.mutateAsync({ examName: examName.trim(), examDate: toCalendarDay(date) });
      await refresh();
      onClose();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    }
  }

  function confirmRemove() {
    Alert.alert("Hedefi kaldır", "Sınav hedefin silinecek. Notların etkilenmez.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: async () => {
          await remove.mutateAsync(undefined);
          await refresh();
          onClose();
        },
      },
    ]);
  }

  return (
    <BottomPanel visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text
          accessibilityRole="header"
          className="mt-[18px] font-display text-2xl tracking-[-0.48px] text-brand-ink"
        >
          Sınav hedefi
        </Text>
        <Text className="mt-1 text-sm text-brand-ink-soft">
          Kalan günü ve günde ne kadar dinlemen gerektiğini hesaplarız.
        </Text>

        <Text className="mt-4 text-sm font-semibold text-brand-ink">Sınav</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {EXAMS.map((exam) => {
            const selected = examName === exam;
            return (
              <Pressable
                key={exam}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setExamName(exam)}
                className={`h-9 justify-center rounded-full border-[1.5px] px-3.5 ${
                  selected ? "border-brand-ink bg-brand-ink" : "border-brand-line bg-white"
                }`}
              >
                <Text className={`text-sm font-semibold ${selected ? "text-white" : "text-brand-body"}`}>
                  {exam}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel="Sınav adı"
          value={examName}
          onChangeText={setExamName}
          maxLength={40}
          placeholder="Ya da sınavın adını yaz"
          placeholderTextColor="#8A8FAD"
          className="mt-2.5 h-12 rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-[15px] text-brand-ink"
        />

        <Text className="mt-4 text-sm font-semibold text-brand-ink">Sınav günü</Text>
        <View className="mt-2 rounded-2xl border-[1.5px] border-brand-hairline p-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selected) => setDate(selected ?? undefined)}
            minDate={today}
            maxDate={maxDate}
            defaultMonth={date ?? today}
            locale="tr-TR"
            weekStartsOn={1}
          />
        </View>

        {error ? (
          <View className="mt-3">
            <FormError>{error}</FormError>
          </View>
        ) : null}

        <AuthButton className="mt-4" loading={upsert.isPending} onPress={() => void save()}>
          Kaydet
        </AuthButton>
        {goal ? (
          <AuthButton
            variant="ghost"
            className="mt-1"
            loading={remove.isPending}
            onPress={confirmRemove}
          >
            Hedefi kaldır
          </AuthButton>
        ) : null}
      </ScrollView>
    </BottomPanel>
  );
}
