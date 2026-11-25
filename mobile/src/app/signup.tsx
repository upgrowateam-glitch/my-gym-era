// Sign-up page (new client account) — same FitZone design as the login page.

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { fitzone as c, font } from '@/theme/colors';
import { useFitZoneFonts } from '@/lib/fonts';
import { FitZoneLogo } from '@/components/fitzone/Brand';
import {
  AuthBackdrop, AuthField, AuthTitle, GlowCard, Message, PrimaryButton, OrDivider, SocialButton, Tagline,
} from '@/components/auth/AuthUI';

const MIN_PASSWORD = 6;

export default function SignupScreen() {
  useFitZoneFonts();
  const { user, register } = useAuth();
  const { width: screenW } = useWindowDimensions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user) return <Redirect href={homeRouteFor(user)} />;
  const width = Math.min(screenW, 460);

  async function submit() {
    setInfo(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/profile-setup'); // new Users go on to the fitness profile (they may skip it)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const notAvailable = (what: string) => {
    setError(null);
    setInfo(`${what} is not available yet.`);
  };

  return (
    <View style={styles.root}>
      <AuthBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View style={{ width, paddingHorizontal: 20, gap: 14 }}>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
                style={styles.back} hitSlop={10} accessibilityLabel="Back to login">
                <Ionicons name="chevron-back" size={24} color={c.text} />
              </Pressable>
              <FitZoneLogo size={26} />
              <AuthTitle first="Create" highlight="Account" subtitle="Start your fitness journey today." />

              {error && <Message text={error} />}
              {info && <Message text={info} kind="info" />}

              <GlowCard>
                <AuthField icon="person-outline" placeholder="Full Name" autoCapitalize="words"
                  autoComplete="name" value={name} onChangeText={setName} />
                <AuthField icon="mail-outline" placeholder="Email Address" keyboardType="email-address"
                  autoComplete="email" value={email} onChangeText={setEmail} />
                <AuthField icon="lock-closed-outline" placeholder={`Password (min. ${MIN_PASSWORD} characters)`} secure
                  autoComplete="new-password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
                <PrimaryButton label="Create Account" icon="arrow-forward" onPress={submit} loading={busy} />
              </GlowCard>

              <OrDivider />
              <SocialButton label="Sign up with Apple" icon={<Ionicons name="logo-apple" size={24} color="#fff" />}
                onPress={() => notAvailable('Apple sign-up')} />
              <SocialButton label="Sign up with Google" icon={<Ionicons name="logo-google" size={20} color="#fff" />}
                onPress={() => notAvailable('Google sign-up')} />

              <View style={styles.row}>
                <Text style={styles.muted}>Already have an account?</Text>
                <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
                  <Text style={styles.link}> Log In</Text>
                </Pressable>
              </View>
              <Tagline />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 8 },
  link: { color: c.mint, fontFamily: font.bold, fontSize: 14 },
  muted: { color: c.textSecondary, fontFamily: font.regular, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingVertical: 6 },
});
