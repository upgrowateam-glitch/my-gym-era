import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

/** Plain dark screen; a small spinner appears only if loading takes a while. */
export function LoadingScreen({ color = '#FF6B00', background = '#080A0E' }: { color?: string; background?: string }) {
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowSpinner(true), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
      {showSpinner && <ActivityIndicator color={color} />}
    </View>
  );
}
