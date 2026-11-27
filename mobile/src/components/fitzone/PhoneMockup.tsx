// Illustration for onboarding slide 2: a phone showing an activity summary.
// Drawn in code (no screenshot image) so it stays sharp at any size.
// The numbers are illustrative example values, not real user data.

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { fitzone as c, font } from '@/theme/colors';
import type { IconName } from '@/components/ui/UI';

const STEPS = 8245;
const GOAL = 10000;

export function PhoneMockup({ width }: { width: number }) {
  const height = width * 2.02;
  const s = width / 200; // scale factor; the design is laid out for a 200 px wide phone
  const ring = 124 * s;
  const stroke = 10 * s;
  const r = (ring - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <View style={[styles.phone, { width, height, borderRadius: 32 * s, borderWidth: 5 * s }]}>
      <View style={[styles.notch, { width: 58 * s, height: 14 * s, borderRadius: 7 * s, marginTop: 8 * s }]} />
      <View style={{ paddingHorizontal: 14 * s, paddingTop: 12 * s, gap: 12 * s, flex: 1 }}>
        <View>
          <Text style={[styles.small, { fontSize: 10 * s }]}>Today</Text>
          <Text style={[styles.title, { fontSize: 16 * s }]}>Activity</Text>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={ring} height={ring} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={ring / 2} cy={ring / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
            <Circle
              cx={ring / 2} cy={ring / 2} r={r}
              stroke={c.mint} strokeWidth={stroke} fill="none" strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - STEPS / GOAL)}
            />
          </Svg>
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.ringCenter}>
              <Ionicons name="footsteps" size={14 * s} color={c.mint} />
              <Text style={[styles.big, { fontSize: 22 * s }]}>{STEPS.toLocaleString('en-US')}</Text>
              <Text style={[styles.small, { fontSize: 9.5 * s }]}>of {GOAL.toLocaleString('en-US')} steps</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 7 * s }}>
          <Stat s={s} icon="flame" label="Calories" value="425 kcal" />
          <Stat s={s} icon="navigate" label="Distance" value="6.2 km" />
          <Stat s={s} icon="time" label="Active time" value="1h 12m" />
        </View>
      </View>
    </View>
  );
}

function Stat({ s, icon, label, value }: { s: number; icon: IconName; label: string; value: string }) {
  return (
    <View style={[styles.stat, { borderRadius: 12 * s, paddingHorizontal: 10 * s, paddingVertical: 8 * s, gap: 8 * s }]}>
      <View style={[styles.statIcon, { width: 24 * s, height: 24 * s, borderRadius: 8 * s }]}>
        <Ionicons name={icon} size={13 * s} color={c.mint} />
      </View>
      <Text style={[styles.statLabel, { fontSize: 11 * s }]}>{label}</Text>
      <Text style={[styles.statValue, { fontSize: 11.5 * s }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { backgroundColor: '#0A0D0F', borderColor: '#1E2529', overflow: 'hidden' },
  notch: { alignSelf: 'center', backgroundColor: '#000000' },
  small: { color: c.textSecondary, fontFamily: font.regular },
  title: { color: c.text, fontFamily: font.bold },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  big: { color: c.text, fontFamily: font.bold },
  stat: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  statIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201,166,107,0.12)' },
  statLabel: { flex: 1, color: c.textSecondary, fontFamily: font.medium },
  statValue: { color: c.text, fontFamily: font.semibold },
});
