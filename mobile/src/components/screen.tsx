import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export function Screen({ title, children }: PropsWithChildren<{ title: string }>) {
  return <ThemedView style={styles.root}><SafeAreaView style={styles.safe}>
    <ThemedText type="subtitle">{title}</ThemedText>
    <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
  </SafeAreaView></ThemedView>;
}

export function Card({ children }: PropsWithChildren) { return <View style={styles.card}>{children}</View>; }
export function LoadingOrError({ loading, error }: { loading: boolean; error?: string }) {
  if (loading) return <ThemedText>Carregando...</ThemedText>;
  if (error) return <ThemedText style={styles.error}>{error}</ThemedText>;
  return null;
}
const styles = StyleSheet.create({ root: { flex: 1 }, safe: { flex: 1, paddingHorizontal: 20 }, content: { paddingVertical: 20, gap: 12 }, card: { padding: 16, borderRadius: 14, backgroundColor: '#F0F0F3', gap: 6 }, error: { color: '#b91c1c' } });
