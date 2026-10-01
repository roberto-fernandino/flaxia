import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ThemedText } from '@/components/themed-text';

export default function ValidationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) router.replace(`/jobs/${id}?tab=validation`);
  }, [id]);

  return <ThemedText> Abrindo validação...</ThemedText>;
}
