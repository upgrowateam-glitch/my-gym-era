// A full page with a gold "Back" link at the top (for pages opened from a list:
// a video, a workout, the video form, sending a workout).

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import type { Palette } from '@/components/ui/UI';

export function BackPage({ p, title, kicker, children, onRefresh, refreshing, maxWidth = 1000, fallback }: {
  p: Palette; title?: string; kicker?: string; children: ReactNode; onRefresh?: () => void; refreshing?: boolean;
  maxWidth?: number; fallback?: Href;
}) {
  const { user } = useAuth();
  const back = () => {
    if (router.canGoBack()) router.back();
    else if (fallback) router.replace(fallback);
    else if (user) router.replace(homeRouteFor(user));
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: 60, gap: 16, width: '100%', maxWidth, alignSelf: 'center' }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={p.accent} /> : undefined}>
          <Pressable onPress={back} hitSlop={10} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-back" size={20} color={p.accent} />
            <Text style={{ color: p.accent, fontWeight: '700', fontSize: 14.5 }}>Back</Text>
          </Pressable>
          {title && (
            <View>
              {kicker && <Text style={{ color: p.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>{kicker}</Text>}
              <Text style={{ color: p.text, fontSize: 26, fontWeight: '800' }}>{title}</Text>
            </View>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
