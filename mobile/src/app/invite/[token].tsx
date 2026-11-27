// Invitation acceptance: opened from a shared invitation link.
// Shows who invited the person and as what, then creates the account.
// The role always comes from the invitation (the server ignores any other).

import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABELS, type InvitationPreview } from '@/lib/types';
import { fitzone as c, font } from '@/theme/colors';
import { useFitZoneFonts } from '@/lib/fonts';
import { FitZoneLogo } from '@/components/fitzone/Brand';
import {
  AuthAccentProvider, AuthBackdrop, AuthField, AuthTitle, GlowCard, GOLD, Message, PrimaryButton, Tagline,
} from '@/components/auth/AuthUI';

const MIN_PASSWORD = 6;

export default function AcceptInvitation() {
  const { token } = useLocalSearchParams<{ token: string }>();
  useFitZoneFonts();
  const { user, acceptInvitation, logout } = useAuth();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW, 460);

  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<{ invitation: InvitationPreview }>(`/api/invitations/token/${encodeURIComponent(token ?? '')}`)
      .then((r) => {
        if (!active) return;
        setInvite(r.invitation);
        setName(r.invitation.name);
        setEmail(r.invitation.email ?? '');
      })
      .catch((e) => active && setLoadError(e instanceof ApiError ? e.message : 'Could not open this invitation.'));
    return () => { active = false; };
  }, [token]);

  async function submit() {
    if (!name.trim()) return setError('Please enter your name.');
    if (!invite?.email && !email.trim()) return setError('Please enter your email address.');
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== password2) return setError('The passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await acceptInvitation(token!, {
        name: name.trim(),
        password,
        ...(invite?.email ? {} : { email: email.trim() }),
      });
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthAccentProvider value={GOLD}>
    <View style={styles.root}>
      <AuthBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View style={{ width, paddingHorizontal: 20, gap: 14, paddingTop: 18 }}>
              <FitZoneLogo size={26} />

              {user ? (
                <>
                  <Message kind="info" text={`You are signed in as ${user.displayName || user.email}. Log out first to accept this invitation with a new account.`} />
                  <PrimaryButton label="Log out and continue" icon="log-out-outline" onPress={() => void logout()} />
                  <Text style={styles.link} onPress={() => router.replace(homeRouteFor(user))}>Go to my dashboard</Text>
                </>
              ) : loadError ? (
                <>
                  <AuthTitle first="Invitation" highlight="unavailable" />
                  <Message text={loadError} />
                  <Text style={styles.muted}>Ask the person who invited you to send a new link.</Text>
                  <PrimaryButton label="Go to login" icon="log-in-outline" onPress={() => router.replace('/login')} />
                </>
              ) : !invite ? (
                <ActivityIndicator color={GOLD.main} style={{ marginTop: 40 }} />
              ) : (
                <>
                  <AuthTitle
                    first="You're"
                    highlight="invited"
                    subtitle={(invite.invitedByName ? `${invite.invitedByName} invited you` : 'You have been invited') + ' to join FitZone.'}
                  />

                  <View style={styles.roleBox}>
                    <Ionicons name={invite.role === 'admin' ? 'shield-checkmark-outline' : 'barbell-outline'} size={26} color={GOLD.main} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleLabel}>Your role</Text>
                      <Text style={styles.roleValue}>{ROLE_LABELS[invite.role]}</Text>
                    </View>
                    <Text style={styles.expires}>Valid until{'\n'}{new Date(invite.expiresAt).toLocaleDateString()}</Text>
                  </View>

                  {error && <Message text={error} />}

                  <GlowCard>
                    <AuthField icon="person-outline" placeholder="Full Name" autoCapitalize="words" value={name} onChangeText={setName} />
                    <AuthField icon="mail-outline" placeholder="Email Address" keyboardType="email-address"
                      value={email} onChangeText={setEmail} editable={!invite.email} />
                    <AuthField icon="lock-closed-outline" placeholder={`Password (min. ${MIN_PASSWORD} characters)`} secure
                      autoComplete="new-password" value={password} onChangeText={setPassword} />
                    <AuthField icon="lock-closed-outline" placeholder="Repeat password" secure
                      autoComplete="new-password" value={password2} onChangeText={setPassword2} onSubmitEditing={submit} />
                    <PrimaryButton label="Create my account" icon="checkmark-circle-outline" onPress={submit} loading={busy} />
                  </GlowCard>
                  {invite.email && <Text style={styles.muted}>This invitation is for {invite.email}.</Text>}
                </>
              )}
              <Tagline />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
    </AuthAccentProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  roleBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(111,224,160,0.4)', backgroundColor: 'rgba(111,224,160,0.07)',
  },
  roleLabel: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  roleValue: { color: c.text, fontFamily: font.bold, fontSize: 20 },
  expires: { color: c.textSecondary, fontFamily: font.regular, fontSize: 11.5, textAlign: 'right' },
  muted: { color: c.textSecondary, fontFamily: font.regular, fontSize: 13.5, textAlign: 'center' },
  link: { color: GOLD.main, fontFamily: font.bold, fontSize: 14, textAlign: 'center', paddingVertical: 6 },
});
