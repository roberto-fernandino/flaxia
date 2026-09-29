import { useLocalSearchParams, router } from 'expo-router';
import { useEffect } from 'react';
import { ThemedText } from '@/components/themed-text';
export default function OperationalResultAlias() { const { id } = useLocalSearchParams<{ id: string }>(); useEffect(() => { if (id) router.replace(`/jobs/${id}`); }, [id]); return <ThemedText>Abrindo resultado...</ThemedText>; }
