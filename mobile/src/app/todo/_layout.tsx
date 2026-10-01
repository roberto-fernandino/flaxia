import { Stack } from 'expo-router';

/** Pilha própria da aba: permite abrir o resultado do job (validação) sem sair da aba. */
export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
