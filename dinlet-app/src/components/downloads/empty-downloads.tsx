import { Text, View } from "react-native";
import { ArrowDownToLine, Library } from "lucide-react-native";
import { router } from "expo-router";
import { AuthButton } from "@/components/auth";

const SHADOW = {
  shadowColor: "#1928B4",
  shadowOpacity: 0.1,
  shadowRadius: 15,
  shadowOffset: { width: 0, height: 12 },
  elevation: 4,
};

export function EmptyDownloads() {
  return (
    <View className="flex-1 items-center justify-center gap-3.5 px-4 py-12">
      {/* İllüstrasyon Kutusu */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="relative mb-2 h-36 w-36 items-center justify-center"
      >
        <View
          className="h-28 w-28 items-center justify-center rounded-[24px] bg-[#EEF0FB]"
          style={SHADOW}
        >
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-indigo">
            <ArrowDownToLine size={32} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </View>
      </View>

      <Text
        accessibilityRole="header"
        className="text-center font-display text-2xl font-bold tracking-[-0.48px] text-[#0E1238]"
      >
        Henüz indirilmiş not yok
      </Text>
      <Text className="max-w-[280px] text-center text-[15px] leading-[22px] text-[#575C7A]">
        İnternet bağlantın olmadan dinlemek istediğin notları indirerek çevrimdışı dinleyebilirsin.
      </Text>

      <AuthButton
        className="mt-2.5 px-6"
        icon={<Library size={18} strokeWidth={2.2} color="#FFFFFF" />}
        onPress={() => router.replace("/(app)/(tabs)")}
      >
        Kütüphaneye git
      </AuthButton>
    </View>
  );
}
