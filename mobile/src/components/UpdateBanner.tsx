// Over-the-air updates (EAS Update).
//
// When the installed app starts, it checks for a newer version in the
// background (app.json: updates.checkAutomatically = ON_LOAD) and downloads it.
// Once it is downloaded, this banner (at the bottom of the screen, above the
// tab bar) offers "Update" so the new version is used straight away
// (otherwise it is used the next time the app starts).
//
// Only active in installed Android / iPhone builds: not on the web and not
// while developing with `npx expo start` / Expo Go.

import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { fitzone as c, font } from '@/theme/colors';
import { GOLD } from '@/components/auth/AuthUI';

const UPDATES_ACTIVE = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;

export function UpdateBanner() {
  return UPDATES_ACTIVE ? <Banner /> : null;
}

function Banner() {
  const { isUpdatePending, isRestarting } = Updates.useUpdates();
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!isUpdatePending || hidden) return null;

  async function restart() {
    try {
      await Updates.reloadAsync();
    } catch {
      setFailed(true); // the new version will still be used at the next start
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Ionicons name="cloud-download-outline" size={22} color={GOLD.main} />
        <Text style={styles.text}>
          {failed ? 'Close and reopen the app to use the new version.' : 'A new version of FitZone is ready.'}
        </Text>
        {!failed && (
          <Pressable onPress={restart} disabled={isRestarting} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>{isRestarting ? 'Updating…' : 'Update'}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setHidden(true)} hitSlop={10} accessibilityLabel="Later">
          <Ionicons name="close" size={20} color={c.textSecondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Bottom of the screen, lifted above the tab bar (about 60 pt) so tabs stay tappable.
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 72 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1E1F23', borderColor: 'rgba(201,166,107,0.55)', borderWidth: 1, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  text: { flex: 1, color: c.text, fontFamily: font.medium, fontSize: 14 },
  button: { backgroundColor: GOLD.main, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { color: GOLD.on, fontFamily: font.semibold, fontSize: 13.5 },
});
