import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  storeLongMeta,
  storePriceLabel,
  storeShortMeta,
  storeSourceLabel,
  storeTag,
  type StoreItem,
} from "@/lib/store-format";

function openItem(item: StoreItem) {
  router.push({ pathname: "/store/items/[id]", params: { id: String(item.id) } });
}

/** Mağaza ana ekranı satırı: harf kutucuğu, başlık, kısa bilgi, fiyat. */
export function StoreCompactRow({ item }: { item: StoreItem }) {
  const free = item.isFree;
  const price = storePriceLabel(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${storeShortMeta(item)}. ${price}`}
      onPress={() => openItem(item)}
      className="flex-row items-center gap-3 border-b border-[#EEF0F7] py-[11px]"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: free ? "#1928B4" : "#EEF0FB" }}
      >
        <Text
          className="font-display text-[13px]"
          style={{ color: free ? "#FFFFFF" : "#1928B4" }}
        >
          {storeTag(item)}
        </Text>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-[15px] font-bold text-brand-ink">
          {item.title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-brand-muted">
          {storeShortMeta(item)}
        </Text>
      </View>
      <Text
        className="text-[13px] font-extrabold"
        style={{ color: item.isOwned ? "#575C7A" : "#1928B4" }}
      >
        {price}
      </Text>
    </Pressable>
  );
}

/** Katalog satırı: ses dalgalı kapak, başlık, süre, kaynak rozeti, fiyat. */
export function StoreCatalogRow({ item }: { item: StoreItem }) {
  const coverBg = item.isOwned ? "#EEF0FB" : item.isFree ? "#1322A0" : "#1928B4";
  const coverFg = item.isOwned ? "#1928B4" : "#FFFFFF";
  const price = storePriceLabel(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${storeLongMeta(item)}. ${price}`}
      onPress={() => openItem(item)}
      className="flex-row gap-3 border-b border-[#EEF0F7] py-3"
    >
      <View
        className="h-[60px] w-12 justify-end rounded-xl p-2"
        style={{ backgroundColor: coverBg }}
      >
        <View className="flex-row items-end gap-0.5">
          {[8, 16, 11].map((height, index) => (
            <View
              key={index}
              className="w-[3px] rounded-sm"
              style={{ height, backgroundColor: coverFg }}
            />
          ))}
        </View>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-[15px] font-bold leading-[19px] text-brand-ink">{item.title}</Text>
        <Text className="text-xs text-brand-muted">{storeLongMeta(item)}</Text>
        <View className="self-start rounded-[5px] bg-brand-lavender px-[7px] py-0.5">
          <Text className="text-[11px] font-bold text-brand-body">{storeSourceLabel(item)}</Text>
        </View>
      </View>
      <Text
        className="self-center text-[13px] font-extrabold"
        style={{ color: item.isOwned ? "#575C7A" : "#1928B4" }}
      >
        {price}
      </Text>
    </Pressable>
  );
}
