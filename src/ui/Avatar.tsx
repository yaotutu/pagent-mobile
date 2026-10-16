import { Bot } from 'lucide-react-native';
import { View } from 'react-native';
import { colors, radius, sizing } from './tokens';

const backgrounds: Record<string, string> = { sky: colors.avatarSky, sand: colors.avatarSand, lilac: colors.avatarLilac };

export function Avatar({ variant, size = sizing.avatar }: { variant?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.bubble, backgroundColor: backgrounds[variant ?? 'sky'] ?? colors.avatarSky, justifyContent: 'center', alignItems: 'center' }}>
      <Bot size={size === sizing.avatarDesktop ? sizing[36] : sizing[30]} strokeWidth={1.5} color={colors.ink} />
    </View>
  );
}
