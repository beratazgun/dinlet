import { Tabs } from "expo-router/js-tabs";
import { LibraryTabBar } from "@/components/library";

/** Kütüphane / Tekrar / Mağaza / İndirilenler / Hesap — tasarımdaki alt menü. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <LibraryTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Kütüphane" }} />
      <Tabs.Screen name="review" options={{ title: "Tekrar" }} />
      <Tabs.Screen name="store" options={{ title: "Mağaza" }} />
      <Tabs.Screen name="downloads" options={{ title: "İndirilenler" }} />
      <Tabs.Screen name="account" options={{ title: "Hesap" }} />
    </Tabs>
  );
}
