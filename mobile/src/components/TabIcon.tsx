import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from './ui/UI';

/** tabBarIcon helper: tabIcon('home-outline') */
export const tabIcon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) =>
  <Ionicons name={name} color={color as string} size={size} />;
