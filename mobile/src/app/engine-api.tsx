import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/lib/api';

type OpenApiOperation = { summary?: string; description?: string; tags?: string[] };
type OpenApiSpec = { paths?: Record<string, Record<string, OpenApiOperation>>; info?: { title?: string; version?: string } };
type Tab = 'api' | 'sdk' | 'api-keys' | 'webhooks';
const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

export default function EngineApiScreen() {
  const [tab, setTab] = useState<Tab>('api');
  const [spec, setSpec] = useState<OpenApiSpec>();
  const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<OpenApiSpec>('/openapi.json').then((response) => setSpec(response.data)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Falha ao carregar a referência da API.')); }, []);
  const operations = useMemo(() => Object.entries(spec?.paths ?? {}).flatMap(([path, pathItem]) => methods.filter((method) => pathItem[method]).map((method) => ({ method: method.toUpperCase(), path, operation: pathItem[method] }))), [spec]);
  return <Screen title="Engine API"><ThemedText>{spec?.info?.title ?? 'FlaxFlow Engine API'} {spec?.info?.version ? `· v${spec.info.version}` : ''}</ThemedText><Card><Pressable style={styles.tabs}>{(['api', 'sdk', 'api-keys', 'webhooks'] as Tab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><ThemedText>{item === 'api' ? 'Referência' : item === 'sdk' ? 'SDK' : item === 'api-keys' ? 'Chaves' : 'Webhooks'}</ThemedText></Pressable>)}</Pressable></Card>{tab === 'api' && <><LoadingOrError loading={!spec && !error} error={error} />{operations.map(({ method, path, operation }, index) => <Card key={`${method}-${path}-${index}`}><ThemedText type="smallBold">{method} {path}</ThemedText><ThemedText>{operation?.summary ?? operation?.description ?? 'Operação da API'}</ThemedText>{operation?.tags?.length ? <ThemedText>Tags: {operation.tags.join(', ')}</ThemedText> : null}</Card>)}{!error && spec && operations.length === 0 && <ThemedText>Nenhuma operação publicada.</ThemedText>}</>}{tab === 'sdk' && <Card><ThemedText type="smallBold">Integração com o SDK</ThemedText><ThemedText>Use uma chave criada na aba Chaves e envie-a no header Authorization.</ThemedText><ThemedText type="code">Authorization: Bearer sk_...</ThemedText><ThemedText type="code">Content-Type: application/json</ThemedText></Card>}{tab === 'api-keys' && <><ThemedText>Gerencie suas chaves de API.</ThemedText><Pressable onPress={() => router.push('/api-keys')}><ThemedText type="linkPrimary">Abrir gerenciamento de chaves</ThemedText></Pressable></>}{tab === 'webhooks' && <><ThemedText>Configure endpoints para receber eventos de processamento.</ThemedText><Pressable onPress={() => router.push('/webhooks')}><ThemedText type="linkPrimary">Abrir gerenciamento de webhooks</ThemedText></Pressable></>}</Screen>;
}
const styles = StyleSheet.create({ tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tab: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 }, activeTab: { backgroundColor: '#D9F1EC' } });
