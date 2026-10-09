import { View } from "react-native";
import { Stack } from "expo-router";
import { MiniPlayer } from "@/components/player";

/** Oturum açık ve zorunlu KVKK onayları verilmişken açılan ekranlar. */
export default function AppLayout() {
  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="pro"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="delete-account"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen name="upload" />
        <Stack.Screen
          name="quiz"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="documents/[id]" />
        <Stack.Screen
          name="record/[sectionId]"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="player"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
      <MiniPlayer />
    </View>
  );
}
