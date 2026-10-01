import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { ThemedView } from '@/components/themed-view';

export default function EntryScreen() {
  const { token } = useAuth();
  useEffect(() => { router.replace(token ? '/dashboard' : '/login'); }, [token]);
  return <ThemedView style={styles.root}><View style={styles.center}><ActivityIndicator color="#0891b2" /></View></ThemedView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
