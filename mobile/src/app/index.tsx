import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const shortcuts = [
  { href: '/process', title: 'Processar documentos', description: 'Envie PDF ou imagens para o Engine.' },
  { href: '/jobs', title: 'Acompanhar jobs', description: 'Veja o andamento dos processamentos.' },
  { href: '/validations', title: 'Validações', description: 'Revise documentos pendentes.' },
  { href: '/chat', title: 'Chat IA', description: 'Consulte os dados da sua operação.' },
] as const;

export default function HomeScreen() {
  return <ThemedView style={styles.root}><SafeAreaView style={styles.safe}><Screen title="FlaxFlow PortalAI"><ThemedText>Escolha uma ação para começar.</ThemedText>{shortcuts.map((shortcut) => <Link key={shortcut.href} href={shortcut.href} asChild><Pressable style={styles.card}><ThemedText type="smallBold">{shortcut.title}</ThemedText><ThemedText>{shortcut.description}</ThemedText></Pressable></Link>)}</Screen></SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, safe: { flex: 1 }, card: { padding: 16, borderRadius: 14, backgroundColor: '#F0F0F3', gap: 5 } });
