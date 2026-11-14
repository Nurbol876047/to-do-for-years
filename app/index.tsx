import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore, useCanEnterApp } from "@/lib/store/auth";
import { useColors } from "@/lib/theme";

export default function Index() {
  const colors = useColors();

  const isLoading = useAuthStore((s) => s.isLoading);
  const canEnterApp = useCanEnterApp();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!canEnterApp) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/week" />;
}
