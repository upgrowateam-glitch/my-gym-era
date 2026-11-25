import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';

/** Temporary screen used while the real screen is being rebuilt. */
export function ComingSoon({ title, accent, background, description, batch, children, showLogout }: {
  title: string;
  accent: string;
  background: string;
  description: string;
  batch?: number;
  children?: ReactNode;
  showLogout?: boolean;
}) {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.kicker, { color: accent }]}>MY GYM ERA</Text>
        <Text style={styles.title}>{title}</Text>
        {user && <Text style={styles.sub}>Signed in as {user.displayName || user.email} ({user.role})</Text>}
        {children}
        <View style={[styles.card, { borderColor: accent + '55' }]}>
          <Ionicons name="construct-outline" size={22} color={accent} />
          <Text style={styles.cardText}>
            {description}
            {batch ? `\nThis screen is being rebuilt in React Native (batch ${batch}).` : ''}
          </Text>
        </View>
        {showLogout && (
          <Pressable onPress={logout} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.8 }]}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, maxWidth: 600, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 3, marginTop: 8 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  sub: { color: '#A3ABB6', fontSize: 14 },
  card: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  cardText: { color: '#C9CED6', flex: 1, fontSize: 14, lineHeight: 20 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50,
    borderRadius: 16, borderWidth: 1, borderColor: '#EF5350', marginTop: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
