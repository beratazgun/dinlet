import { Stack } from "expo-router";

export const unstable_settings = {
  initialRouteName: "welcome",
};

/** Oturum yokken açılan ekranlar: karşılama, giriş, kayıt, e-posta onayı. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
