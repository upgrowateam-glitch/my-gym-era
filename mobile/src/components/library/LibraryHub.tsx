// The Library tab: switch between workout videos and foods.
// Open the foods directly with ?section=foods.

import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Chips, type Palette } from '@/components/ui/UI';
import { FoodsScreen } from '@/components/nutrition/FoodsScreen';
import { LibraryScreen } from './LibraryScreen';

type Section = 'videos' | 'foods';

export function LibraryHub({ p, canEdit, canSend }: { p: Palette; canEdit: boolean; canSend: boolean }) {
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<Section>(params.section === 'foods' ? 'foods' : 'videos');
  // Links like "/admin/library?section=foods" switch even when the tab is already open.
  const [seen, setSeen] = useState(params.section);
  if (params.section !== seen) {
    setSeen(params.section);
    if (params.section === 'foods' || params.section === 'videos') setSection(params.section);
  }
  return (
    <View style={{ gap: 16 }}>
      <Chips p={p} value={section} onChange={setSection} options={[
        { value: 'videos', label: '🎬  Workout videos' }, { value: 'foods', label: '🥗  Foods & nutrition' },
      ]} />
      {section === 'videos' ? <LibraryScreen p={p} canEdit={canEdit} canSend={canSend} /> : <FoodsScreen p={p} canEdit={canEdit} canSend={canSend} />}
    </View>
  );
}
