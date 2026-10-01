import { Stack } from 'expo-router';

/** Pilha própria da aba Projetos: lista → workspace, com gesto de voltar nativo. */
export default function ProjectsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
