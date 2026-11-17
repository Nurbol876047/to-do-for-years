import { useMemo } from "react";
import { Link, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeSwitch } from "@/components/ThemeSwitch";

import { SIDEBAR_BREAKPOINT, useColors, type Palette } from "@/lib/theme";

interface NavItem {
  href:
    | "/week"
    | "/today"
    | "/inbox"
    | "/schedule"
    | "/review"
    | "/calendar"
    | "/finance"
    | "/chat"
    | "/diary";
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/week", label: "Неделя" },
  { href: "/today", label: "Сегодня" },
  { href: "/inbox", label: "Входящие" },
  { href: "/schedule", label: "Расписание" },
  { href: "/review", label: "Обзор" },
  { href: "/calendar", label: "Календарь" },
  { href: "/finance", label: "Финансы" },
  { href: "/chat", label: "Чат" },
  { href: "/diary", label: "Дневник" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isSidebar = width >= SIDEBAR_BREAKPOINT;

  if (isSidebar) {
    return (
      <View style={styles.sidebarRoot}>
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>Планировщик</Text>
          <ThemeSwitch />
          <View style={styles.sidebarNavGap} />
          <View style={styles.sidebarNav}>
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} variant="sidebar" />
            ))}
          </View>
        </View>
        <View style={styles.sidebarContent}>{children}</View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mobileRoot} edges={["top", "bottom"]}>
      <View style={styles.mobileContent}>{children}</View>
      <View style={styles.mobileTheme}>
        <ThemeSwitch />
      </View>
      <View style={styles.tabBar}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} variant="tab" />
        ))}
      </View>
    </SafeAreaView>
  );
}

function NavLink({
  item,
  active,
  variant,
}: {
  item: NavItem;
  active: boolean;
  variant: "sidebar" | "tab";
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (variant === "sidebar") {
    return (
      <Link href={item.href} asChild>
        <Pressable style={StyleSheet.flatten([styles.sidebarItem, active && styles.sidebarItemActive])}>
          <Text style={StyleSheet.flatten([styles.sidebarItemText, active && styles.sidebarItemTextActive])}>
            {item.label}
          </Text>
        </Pressable>
      </Link>
    );
  }

  return (
    <Link href={item.href} asChild>
      <Pressable style={styles.tabItem}>
        <Text style={StyleSheet.flatten([styles.tabItemText, active && styles.tabItemTextActive])}>
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  sidebarRoot: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.background,
  },
  sidebar: {
    width: 240,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  sidebarNavGap: {
    height: 18,
  },
  sidebarNav: {
    gap: 4,
  },
  sidebarItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sidebarItemActive: {
    backgroundColor: colors.accentMuted,
  },
  sidebarItemText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: "500",
  },
  sidebarItemTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  mobileTheme: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sidebarContent: {
    flex: 1,
  },
  mobileRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  tabItemText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  tabItemTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
});
