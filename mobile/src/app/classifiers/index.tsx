import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Input, Sheet, useProjectColors } from '@/components/projects/ui';
import { ClassifierSummary, errorMessage, projectsApi } from '@/lib/projects';

export default function ProjectsScreen() {
  const { token } = useAuth();
  const c = useProjectColors();
  const [items, setItems] = useState<ClassifierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const r = await projectsApi.list(token);
      setItems(r.data ?? []);
      setError(undefined);
    } catch {
      setError('Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const r = await projectsApi.create(token, trimmed);
      if (r.data) {
        setShowCreate(false);
        setName('');
        router.push(`/classifiers/${r.data}`);
      }
    } catch (e) {
      setCreateError(errorMessage(e, 'Falha ao criar projeto.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <ThemedText type="subtitle">Projetos</ThemedText>
          <Button variant="success" small label="Criar projeto" onPress={() => setShowCreate(true)} />
        </View>
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {loading ? (
            <ThemedText style={{ color: c.textMuted }}>Carregando…</ThemedText>
          ) : error ? (
            <ThemedText style={{ color: '#dc2626' }}>{error}</ThemedText>
          ) : items.length === 0 ? (
            <ThemedText style={{ color: c.textMuted }}>Ainda não há projetos.</ThemedText>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.classifierId}
                onPress={() => router.push(`/classifiers/${item.classifierId}`)}
                style={({ pressed }) => [s.card, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 17, fontWeight: '600', color: c.text }}>{item.name}</ThemedText>
                  <ThemedText style={{ fontSize: 13, color: c.textMuted }}>{item.modelsCount} classes</ThemedText>
                </View>
                <ThemedText style={{ color: c.textMuted, fontSize: 18 }}>›</ThemedText>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <Sheet
        visible={showCreate}
        title="Novo projeto"
        subtitle="Informe um nome para abrir o workspace."
        onClose={() => setShowCreate(false)}
        closeDisabled={creating}
        footer={
          <>
            <Button variant="secondary" label="Cancelar" disabled={creating} onPress={() => setShowCreate(false)} />
            <Button variant="success" label={creating ? 'Criando…' : 'Criar'} loading={creating} disabled={!name.trim()} onPress={() => void create()} />
          </>
        }>
        <Input value={name} onChangeText={setName} placeholder="Nome do projeto" autoFocus returnKeyType="done" onSubmitEditing={() => void create()} />
        {createError && <ThemedText style={{ color: '#dc2626' }}>{createError}</ThemedText>}
      </Sheet>
    </ThemedView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  list: { paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 16 },
});
