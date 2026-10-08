import { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export function Screen({ title, children }: PropsWithChildren<{ title: string }>) {
  return <ThemedView style={styles.root}><SafeAreaView style={styles.safe}>
    <ThemedText type="subtitle">{title}</ThemedText>
    <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
  </SafeAreaView></ThemedView>;
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>;
}

export function Field({ style, ...props }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.field, { borderColor: theme.border, backgroundColor: theme.input, color: theme.text }, style]}
    />
  );
}

export function FilterChip({
  label,
  active,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.chipActive : theme.chip }, style]}
    >
      <ThemedText style={styles.chipLabel}>{label}</ThemedText>
    </Pressable>
  );
}
export function LoadingOrError({ loading, error }: { loading: boolean; error?: string }) {
  const theme = useTheme();
  if (loading) return <ThemedText>Carregando...</ThemedText>;
  if (error) return <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>;
  return null;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 20 },
  content: { paddingVertical: 20, gap: 12, paddingBottom: 32 },
  card: { padding: 16, borderRadius: 14, gap: 6 },
  field: { borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  chipLabel: { fontWeight: '600', textAlign: 'center' },
});
