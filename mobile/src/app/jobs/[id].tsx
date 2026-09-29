import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, LoadingOrError, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

type Job = Record<string, unknown>;
type Tab = 'overview' | 'validation' | 'audit';

export default function JobDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { token } = useAuth();
  const [job, setJob] = useState<Job>();
  const [result, setResult] = useState<unknown>();
  const [resultText, setResultText] = useState('');
  const [audit, setAudit] = useState<unknown>();
  const [activeTab, setActiveTab] = useState<Tab>(tab === 'audit' || tab === 'validation' ? tab : 'overview');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(undefined);
      const [j, r, a] = await Promise.all([
        apiRequest<Job>(`/engine/processing_jobs/${id}`, {}, token ?? undefined),
        apiRequest<unknown>(`/engine/processing_jobs/${id}/result`, {}, token ?? undefined),
        apiRequest<unknown>(`/engine/audit_events/${id}`, {}, token ?? undefined),
      ]);
      setJob(j.data); setResult(r.data); setResultText(JSON.stringify(r.data ?? {}, null, 2)); setAudit(a.data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar o resultado.'); }
  }, [id, token]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(endpoint: string, method: 'PATCH' | 'POST') {
    if (!id) return;
    setBusy(true);
    try { await apiRequest(`/engine/processing_jobs/${id}/${endpoint}`, { method }, token ?? undefined); setMessage('Status atualizado.'); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao atualizar o job.'); }
    finally { setBusy(false); }
  }
  async function saveResult() {
    if (!id) return;
    try { const parsed = JSON.parse(resultText) as unknown; await apiRequest(`/engine/processing_jobs/${id}/result`, { method: 'PUT', body: JSON.stringify({ result: parsed }) }, token ?? undefined); setResult(parsed); setMessage('Resultado salvo.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'JSON inválido ou falha ao salvar resultado.'); }
  }
  async function shareDocument() {
    if (!id || !token) return;
    setDownloading(true);
    try {
      const filename = `flaxflow-${id}.bin`;
      const destination = new File(Paths.cache, filename);
      const task = File.createDownloadTask(`${process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://api.flaxia.com.br'}/engine/processing_job/${id}/document`, destination, { headers: { Authorization: `Bearer ${token}` } });
      const downloaded = await task.downloadAsync();
      if (!downloaded) throw new Error('Download interrompido.');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento não disponível neste dispositivo.');
      await Sharing.shareAsync(downloaded.uri, { dialogTitle: 'Abrir documento processado' });
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao baixar documento.'); }
    finally { setDownloading(false); }
  }

  const status = String(job?.status ?? '');
  const isFinished = ['completed', 'waiting_validation', 'rejected'].includes(status.toLowerCase());
  return <Screen title="Resultado do processamento">
    <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Voltar</ThemedText></Pressable>
    <LoadingOrError loading={!job && !error} error={error} />
    {message && <ThemedText>{message}</ThemedText>}
    {job && <>
      <Card><ThemedText type="smallBold">Resumo</ThemedText><ThemedText>Status: {status || 'desconhecido'}</ThemedText><ThemedText>Arquivo: {String(job.file_name ?? job.fileName ?? job.original_file_name ?? '—')}</ThemedText><ThemedText>Início: {String(job.started_at ?? job.startedAt ?? '—')}</ThemedText><ThemedText>Fim: {String(job.completed_at ?? job.completedAt ?? '—')}</ThemedText></Card>
      <View style={styles.tabs}>{(['overview', 'validation', 'audit'] as Tab[]).map((value) => <Pressable key={value} onPress={() => setActiveTab(value)} style={[styles.tab, activeTab === value && styles.activeTab]}><ThemedText>{value === 'overview' ? 'Visão geral' : value === 'validation' ? 'Validação' : 'Auditoria'}</ThemedText></Pressable>)}</View>
      {activeTab === 'overview' && <Card><ThemedText type="smallBold">Dados extraídos</ThemedText><Pressable disabled={downloading} onPress={() => void shareDocument()}><ThemedText type="linkPrimary">{downloading ? 'Baixando documento...' : 'Abrir/compartilhar documento original'}</ThemedText></Pressable><TextInput value={resultText} onChangeText={setResultText} multiline style={styles.editor} placeholder={result ? JSON.stringify(result, null, 2) : '{}'} /><Pressable onPress={() => void saveResult()} style={styles.save}><ThemedText style={styles.white}>Salvar resultado</ThemedText></Pressable></Card>}
      {activeTab === 'validation' && <Card><ThemedText type="smallBold">Ações de validação</ThemedText><ThemedText>Revise os dados extraídos antes de confirmar o resultado.</ThemedText><View style={styles.actions}><Pressable disabled={busy || !isFinished} onPress={() => void mutate('mark_validated', 'PATCH')} style={styles.success}><ThemedText style={styles.white}>Marcar validado</ThemedText></Pressable><Pressable disabled={busy || !isFinished} onPress={() => void mutate('mark_rejected', 'PATCH')} style={styles.reject}><ThemedText style={styles.white}>Rejeitar</ThemedText></Pressable></View><Pressable disabled={busy} onPress={() => void mutate('refresh_ocr', 'POST')}><ThemedText type="linkPrimary">Atualizar OCR</ThemedText></Pressable></Card>}
      {activeTab === 'audit' && <Card><ThemedText type="smallBold">Linha do tempo de auditoria</ThemedText><ThemedText selectable>{audit ? JSON.stringify(audit, null, 2) : 'Nenhum evento de auditoria.'}</ThemedText></Card>}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ tabs: { flexDirection: 'row', gap: 8 }, tab: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#e5e7eb', alignItems: 'center' }, activeTab: { backgroundColor: '#bfdbfe' }, actions: { flexDirection: 'row', gap: 8 }, editor: { minHeight: 220, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: '#fff', fontFamily: 'monospace', textAlignVertical: 'top' }, save: { padding: 12, borderRadius: 8, backgroundColor: '#208AEF', alignItems: 'center', marginTop: 8 }, success: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#15803d', alignItems: 'center' }, reject: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#b91c1c', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
