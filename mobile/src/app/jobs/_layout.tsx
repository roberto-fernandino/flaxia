import { Stack } from 'expo-router';

/** Pilha própria da aba Jobs: lista → resultado (/jobs/[id]), que NativeTabs sozinho não abre. */
export default function JobsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
