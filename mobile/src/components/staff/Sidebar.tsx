// Left sidebar menu for the staff areas on wide screens (computer / tablet).
// Used as the tab bar of a <Tabs> layout (tabBarPosition 'left'); phones keep
// the normal bottom tabs. Items come from the layout's tab screens.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { ROLE_LABELS } from '@/lib/types';
import { Avatar, type Palette } from '@/components/ui/UI';

const LOGO = require('../../../assets/brand/logo.png');

/** Screens at least this wide get the sidebar instead of bottom tabs. */
export const SIDEBAR_MIN_WIDTH = 900;
export const SIDEBAR_WIDTH = 248;

export function Sidebar({ p, state, descriptors, navigateToTab, insets }: BottomTabBarProps & { p: Palette }) {
  const { user, logout } = useAuth();

  return (
    <View style={[styles.root, { backgroundColor: p.card, borderRightColor: p.border, paddingTop: insets.top + 22, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.brand}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" accessibilityIgnoresInvertColors />
        <View>
          <Text style={[styles.brandName, { color: p.text }]}>FitZone</Text>
          <Text style={[styles.brandRole, { color: p.accent }]}>{user ? ROLE_LABELS[user.role].toUpperCase() : ''}</Text>
        </View>
      </View>

      <View style={{ gap: 4, marginTop: 26 }}>
        {state.routes.map((route, i) => {
          const options = descriptors[route.key].options;
          // Tabs hidden with href: null (e.g. an Admin without that access switch).
          const hidden = (options as { hidden?: boolean }).hidden === true
            || (options.tabBarItemStyle as { display?: string } | undefined)?.display === 'none';
          if (hidden) return null;
          const active = state.index === i;
          const color = active ? p.onAccent : p.textSecondary;
          const label = typeof options.title === 'string' ? options.title : route.name;
          return (
            <Pressable key={route.key} onPress={() => navigateToTab(route.key)} accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.item,
                active && { backgroundColor: p.accent },
                !active && (pressed || hovered) && { backgroundColor: p.elevated },
              ]}>
              {options.tabBarIcon?.({ focused: active, color, size: 20 })}
              <Text style={[styles.itemText, { color: active ? p.onAccent : p.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {user && (
        <View style={[styles.userCard, { backgroundColor: p.elevated, borderColor: p.border }]}>
          <Avatar p={p} name={user.displayName || user.email} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.text, fontWeight: '700' }} numberOfLines={1}>{user.displayName || '—'}</Text>
            <Text style={{ color: p.textSecondary, fontSize: 12 }} numberOfLines={1}>{user.email}</Text>
          </View>
        </View>
      )}
      <Pressable onPress={async () => { if (await confirm('Log out', 'Do you want to log out?', 'Log out')) await logout(); }}
        style={({ pressed }) => [styles.item, { marginTop: 8 }, pressed && { backgroundColor: p.elevated }]}
        accessibilityRole="button">
        <Ionicons name="log-out-outline" size={20} color={p.textSecondary} />
        <Text style={[styles.itemText, { color: p.textSecondary }]}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SIDEBAR_WIDTH, height: '100%', borderRightWidth: 1, paddingHorizontal: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6 },
  logo: { width: 46, height: 46, borderRadius: 23 },
  brandName: { fontSize: 20, fontWeight: '800' },
  brandRole: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  itemText: { fontSize: 15, fontWeight: '600' },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1 },
});
