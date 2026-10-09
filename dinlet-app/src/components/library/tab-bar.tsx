import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import type { Tabs } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const ACTIVE = "#1928B4";
const INACTIVE = "#6B7090";

function LibraryIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3.5} y={4} width={5} height={16} rx={1.2} />
      <Rect x={10.5} y={4} width={5} height={16} rx={1.2} />
      <Path d="M17.5 5.5l3 .8-3.4 13.6" />
    </Svg>
  );
}

function ReviewIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <Path d="M20 4v7h-7" />
    </Svg>
  );
}

function StoreIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8h16l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3z" />
      <Path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
    </Svg>
  );
}

function DownloadsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Svg>
  );
}

function AccountIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Svg>
  );
}

const TABS: Record<string, { label: string; Icon: typeof LibraryIcon }> = {
  index: { label: "Kütüphane", Icon: LibraryIcon },
  review: { label: "Tekrar", Icon: ReviewIcon },
  store: { label: "Mağaza", Icon: StoreIcon },
  downloads: { label: "İndirilenler", Icon: DownloadsIcon },
  account: { label: "Hesap", Icon: AccountIcon },
};

/** Tasarımdaki alt menü: beyaz zemin, üstte ince çizgi, beş eşit sekme. */
export function LibraryTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-t border-[#E9EBF5] bg-white px-1.5 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? ACTIVE : INACTIVE;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            className="h-14 flex-1 items-center justify-center gap-1"
          >
            <tab.Icon color={color} />
            <Text
              numberOfLines={1}
              className={`text-[11px] ${focused ? "font-bold" : "font-semibold"}`}
              style={{ color }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
