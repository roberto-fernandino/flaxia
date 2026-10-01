import { router, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { palette, useProjectColors } from '@/components/projects/ui';
import { buildFieldColorsMap } from '@/lib/engine/fieldTypeColors';
import { isDegenerateOcrGeometry, normalizeOcrPages } from '@/lib/engine/ocrPages';
import {
  TableRow,
  flattenResultToDisplayValues,
  owningFieldKey,
  rebuildResultFromDisplayValues,
  replaceTableRowsInDisplayValues,
} from '@/lib/engine/tableFieldValues';
import { type Field, type ProcessingJob, ProcessingJobsStatus } from '@/lib/engine/types';
import type { ClassDocument } from '@/lib/projects';
import { resultApi } from '@/lib/result-api';
import { AuditTimeline } from './audit-timeline';
import { ResultDocumentViewer } from './document-viewer';
import { ExportSheet } from './export-sheet';
import { ExtractedValuesPanel } from './extracted-values';
import { OverviewTab, STATUS_LABELS, statusColors } from './overview-tab';

type Tab = 'overview' | 'validation' | 'audit';
type Feedback = { type: 'success' | 'error'; message: string };

const sortedJson = (m: Record<string, string>) => JSON.stringify(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Resultado do processamento — porta mobile de `ProcessResultWorkspace` (web):
 * abas Validação / Visão Geral / Trilha de Auditoria, validar/rejeitar só quando
 * o job aguarda validação, lock de validação no fluxo A fazer, lote de arquivos.
 */
export function ProcessResultScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string; batchId?: string }>();
  const pathname = usePathname();
  const isOperational = pathname.startsWith('/todo') || pathname.startsWith('/operational');
  const { token } = useAuth();
  const c = useProjectColors();
  const { height: screenH } = useWindowDimensions();

  const [selectedJobId, setSelectedJobId] = useState(String(params.id));
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [batchJobs, setBatchJobs] = useState<ProcessingJob[]>([]);
  const [classes, setClasses] = useState<ClassDocument[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(params.tab === 'audit' || params.tab === 'overview' || params.tab === 'validation' ? params.tab : null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [marking, setMarking] = useState<'validated' | 'rejected' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [fieldsFirst, setFieldsFirst] = useState(false);
  const [auditRefresh, setAuditRefresh] = useState(0);
  const ocrRefreshTried = useRef(new Set<string>());

  const currentJobId = batchJobs.length > 0 ? (batchJobs.find((j) => j.processJobId === selectedJobId)?.processJobId ?? batchJobs[0].processJobId) : selectedJobId;

  const loadJob = useCallback(async () => {
    try {
      const r = await resultApi.job(token, currentJobId);
      setJob(r.data ?? null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [currentJobId, token]);

  const loadBatch = useCallback(async () => {
    if (!params.batchId) return;
    try {
      const r = await resultApi.batch(token, params.batchId);
      setBatchJobs(r.data?.jobs ?? []);
    } catch {
      // lote opcional
    }
  }, [params.batchId, token]);

  useFocusEffect(useCallback(() => { void loadJob(); void loadBatch(); }, [loadJob, loadBatch]));
  useEffect(() => { void resultApi.classes(token).then((r) => setClasses(r.data ?? [])).catch(() => undefined); }, [token]);
  useEffect(() => { setJob(null); setFeedback(null); }, [currentJobId]);

  // Substitui o stream SSE: atualiza enquanto o job ainda processa.
  useEffect(() => {
    if (job?.status !== ProcessingJobsStatus.Processing) return;
    const t = setInterval(() => { void loadJob(); void loadBatch(); }, 5000);
    return () => clearInterval(t);
  }, [job?.status, loadJob, loadBatch]);

  // Jobs antigos com caixas OCR degeneradas: re-OCR só das caixas, sem mexer no resultado (automático, como no web).
  useEffect(() => {
    if (!job || ocrRefreshTried.current.has(currentJobId)) return;
    if (!isDegenerateOcrGeometry(normalizeOcrPages(job.ocrData ?? null))) return;
    ocrRefreshTried.current.add(currentJobId);
    resultApi.refreshOcr(token, currentJobId).then(() => setTimeout(() => void loadJob(), 3000)).catch(() => ocrRefreshTried.current.delete(currentJobId));
  }, [job, currentJobId, token, loadJob]);

  const relatedDocument = useMemo(() => {
    const id = job?.documentId;
    if (!id) return undefined;
    return classes.find((d) => String(d.documentId).toLowerCase() === String(id).toLowerCase());
  }, [classes, job?.documentId]);
  const documentFields = useMemo(() => (relatedDocument?.fields ?? []) as Field[], [relatedDocument]);

  const showValidation = (job?.isValidating ?? true) !== false || batchJobs.some((j) => j.isValidating !== false && j.status === ProcessingJobsStatus.WaitingValidation);
  const tabs: { id: Tab; label: string }[] = [
    ...(showValidation ? [{ id: 'validation' as Tab, label: 'Validação' }] : []),
    { id: 'overview', label: 'Visão Geral' },
    { id: 'audit', label: 'Trilha de Auditoria' },
  ];
  const tab: Tab = activeTab && (activeTab !== 'validation' || showValidation) ? activeTab : showValidation ? 'validation' : 'overview';

  const pendingBatchJob = batchJobs.find((j) => j.isValidating !== false && j.status === ProcessingJobsStatus.WaitingValidation);
  const jobToValidateId = job?.status === ProcessingJobsStatus.WaitingValidation ? currentJobId : (pendingBatchJob?.processJobId ?? null);
  const canMark = !!jobToValidateId;

  const isJobValidated = !!job && (job.documentValidated === true || !!job.validatedAt || job.status === ProcessingJobsStatus.Rejected || (job.isValidating !== false && job.status === ProcessingJobsStatus.Completed));

  // Lock de validação no fluxo operacional (A fazer): mantém o job reivindicado enquanto aberto.
  const lockTarget = isOperational && job?.status === ProcessingJobsStatus.WaitingValidation && job.isValidating !== false ? currentJobId : null;
  useEffect(() => {
    if (!lockTarget || !token) return;
    void resultApi.claimLock(token, lockTarget).catch(() => undefined);
    const hb = setInterval(() => void resultApi.heartbeatLock(token, lockTarget).catch(() => undefined), 30000);
    return () => {
      clearInterval(hb);
      void resultApi.releaseLock(token, lockTarget).catch(() => undefined);
    };
  }, [lockTarget, token]);

  const mark = async (kind: 'validated' | 'rejected') => {
    if (!jobToValidateId || marking) return;
    setFeedback(null);
    setMarking(kind);
    try {
      const r = kind === 'validated' ? await resultApi.markValidated(token, jobToValidateId) : await resultApi.markRejected(token, jobToValidateId);
      if (!r.success) throw new Error(r.message);
      if (isOperational) {
        router.back();
        return;
      }
      setFeedback({ type: 'success', message: kind === 'validated' ? 'Documento marcado como validado.' : 'Extração do documento rejeitada.' });
      await Promise.all([loadJob(), loadBatch()]);
      setAuditRefresh((n) => n + 1);
    } catch (e) {
      const fallback = kind === 'validated' ? 'Não foi possível marcar o documento como validado. Tente novamente.' : 'Não foi possível rejeitar esta extração. Tente novamente.';
      setFeedback({ type: 'error', message: e instanceof Error && e.message ? e.message : fallback });
    } finally {
      setMarking(null);
    }
  };

  const confirmReject = () =>
    Alert.alert('Rejeitar', 'Rejeitar esta extração? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Rejeitar', style: 'destructive', onPress: () => void mark('rejected') },
    ]);

  // ---------- Estado de validação (valores editados) ----------
  const originalResult = useMemo(() => (job?.result && typeof job.result === 'object' && !Array.isArray(job.result) ? job.result : null), [job?.result]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [scrollToken, setScrollToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const initFor = useRef<string | null>(null);

  useEffect(() => {
    if (!originalResult || initFor.current === `${currentJobId}:${documentFields.length}`) return;
    const flat = flattenResultToDisplayValues(originalResult, documentFields);
    setValues(flat);
    setSavedValues(flat);
    setSelectedKey(null);
    initFor.current = `${currentJobId}:${documentFields.length}`;
  }, [originalResult, currentJobId, documentFields]);

  const fieldColors = useMemo(
    () => buildFieldColorsMap(documentFields, Array.from(new Set([...Object.keys(originalResult ?? {}), ...Object.keys(values)]))),
    [documentFields, originalResult, values],
  );
  const hasModificationsVsOriginal = useMemo(
    () => !!originalResult && sortedJson(values) !== sortedJson(flattenResultToDisplayValues(originalResult, documentFields)),
    [values, originalResult, documentFields],
  );
  const exportData = useMemo(() => (originalResult ? rebuildResultFromDisplayValues(values, originalResult, documentFields) : null), [values, originalResult, documentFields]);

  const selectField = (key: string | null) => {
    setSelectedKey(key);
    if (key) setScrollToken((n) => n + 1);
  };

  const onSelectedText = (text: string) => {
    if (isJobValidated || !selectedKey) return;
    setValues((prev) => (prev[selectedKey] === text ? prev : { ...prev, [selectedKey]: text }));
  };

  const onTableRowsChange = (field: Field, rows: TableRow[], structural: boolean) => {
    if (isJobValidated) return;
    setValues((prev) => replaceTableRowsInDisplayValues(prev, field, rows));
    if (structural && selectedKey && owningFieldKey(selectedKey, documentFields) === field.fieldName) setSelectedKey(null);
  };

  const save = async () => {
    if (!originalResult) return;
    const keys = new Set([...Object.keys(values), ...Object.keys(savedValues)]);
    const changes = [...keys].map((k) => ({ fieldName: k, oldValue: savedValues[k], newValue: values[k] })).filter((ch) => ch.oldValue !== ch.newValue);
    if (changes.length === 0) return;
    setSaving(true);
    try {
      await resultApi.updateResult(token, currentJobId, rebuildResultFromDisplayValues(values, originalResult, documentFields));
      await resultApi
        .createAuditEvent(token, {
          processJobId: currentJobId,
          eventType: 'field_edit',
          description: `Edited ${changes.length} ${changes.length === 1 ? 'field' : 'fields'}`,
          elementId: 'field-edit-save',
          elementType: 'button',
          eventData: { changes },
        })
        .catch(() => undefined);
      setSavedValues(values);
      setAuditRefresh((n) => n + 1);
      setFeedback({ type: 'success', message: 'Alterações salvas.' });
    } catch (e) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Falha ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  // Métricas de uso da tela de validação (duração, toques, digitação) — enviadas ao sair.
  const metrics = useRef({ start: 0, taps: 0, keys: 0 });
  useEffect(() => {
    if (tab !== 'validation' || !currentJobId) return;
    metrics.current = { start: Date.now(), taps: 0, keys: 0 };
    const id = currentJobId;
    return () => {
      const m = metrics.current;
      void resultApi.validationMetrics(token, id, { durationMs: Date.now() - m.start, mouseClicks: m.taps, keyPresses: m.keys }).catch(() => undefined);
    };
  }, [tab, currentJobId, token]);

  const [statusBg, statusFg] = statusColors(String(job?.status ?? ''), c.dark);
  const viewerHeight = Math.max(260, Math.round(screenH * 0.42));

  const fieldsScrollRef = useRef<ScrollView>(null);
  const scrollFieldsTo = useCallback((y: number) => fieldsScrollRef.current?.scrollTo({ y, animated: true }), []);

  const viewer = job && (
    <ResultDocumentViewer
      key={currentJobId}
      processJobId={currentJobId}
      token={token}
      fileType={job.documentFileType}
      fileName={job.documentFileName}
      ocrData={job.ocrData ?? null}
      displayValues={values}
      fieldColors={fieldColors}
      selectedFieldKey={selectedKey}
      scrollToken={scrollToken}
      readOnly={isJobValidated}
      documentFields={documentFields}
      onFieldSelect={(k) => selectField(k)}
      onDeselect={() => { Keyboard.dismiss(); setSelectedKey(null); }}
      onSelectedText={onSelectedText}
      height={viewerHeight}
    />
  );
  const fields = (
    <ExtractedValuesPanel
      originalResult={originalResult}
      values={values}
      savedValues={savedValues}
      documentFields={documentFields}
      fieldColors={fieldColors}
      selectedFieldKey={selectedKey}
      readOnly={isJobValidated}
      isSaving={saving}
      onSelect={selectField}
      onChange={(k, v) => { metrics.current.keys += 1; setValues((prev) => ({ ...prev, [k]: v })); }}
      onTableRowsChange={onTableRowsChange}
      onSave={() => void save()}
      onScrollTo={scrollFieldsTo}
      onReset={() => originalResult && setValues(flattenResultToDisplayValues(originalResult, documentFields))}
    />
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))} style={s.back}>
            <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Voltar</ThemedText>
          </Pressable>
          <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 18, fontWeight: '700', color: c.text }}>Resultado do Processamento</ThemedText>
          {job && <View style={[s.status, { backgroundColor: statusBg }]}><ThemedText style={{ fontSize: 10, fontWeight: '700', color: statusFg }}>{STATUS_LABELS[String(job.status)] ?? job.status}</ThemedText></View>}
        </View>

        {batchJobs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.batch}>
            {batchJobs.map((bj) => {
              const active = bj.processJobId === currentJobId;
              const cls = classes.find((d) => d.documentId === bj.documentId)?.displayName;
              const pending = bj.isValidating !== false && bj.status === ProcessingJobsStatus.WaitingValidation;
              return (
                <Pressable key={bj.processJobId} onPress={() => setSelectedJobId(bj.processJobId)} style={[s.batchItem, { borderColor: active ? '#06b6d4' : c.border, backgroundColor: active ? (c.dark ? 'rgba(8,145,178,0.25)' : '#ecfeff') : c.surface }]}>
                  <ThemedText numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: c.text, maxWidth: 150 }}>{bj.documentFileName ?? bj.processJobId.slice(0, 8)}</ThemedText>
                  <ThemedText numberOfLines={1} style={{ fontSize: 10, color: c.textMuted }}>{cls ?? '—'} · {STATUS_LABELS[String(bj.status)] ?? bj.status}</ThemedText>
                  {pending && <ThemedText style={{ fontSize: 9, fontWeight: '700', color: '#b45309' }}>VALIDAÇÃO PENDENTE</ThemedText>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {!job ? (
          <View style={s.center}>
            <ThemedText style={{ color: loadError ? palette.danger : c.textMuted }}>{loadError ? 'Falha ao carregar resultado do processamento.' : 'Carregando resultado...'}</ThemedText>
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
            <View style={[s.tabs, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <Pressable key={t.id} onPress={() => setActiveTab(t.id)} style={[s.tab, active && { backgroundColor: c.surface, borderColor: 'rgba(34,211,238,0.7)' }]}>
                    <View style={[s.tabDot, { backgroundColor: active ? '#06b6d4' : '#d1d5db' }]} />
                    <ThemedText numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: active ? '#0e7490' : c.textMuted }}>{t.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {showValidation && (tab === 'validation' || canMark) && (
              <View style={s.actions}>
                {canMark && (
                  <>
                    <Pressable disabled={!!marking} onPress={confirmReject} style={[s.action, { borderColor: '#dc2626', backgroundColor: c.surface, opacity: marking ? 0.6 : 1 }]}>
                      <ThemedText style={{ color: c.dark ? '#fca5a5' : '#b91c1c', fontWeight: '600', fontSize: 13 }}>{marking === 'rejected' ? 'Rejeitando...' : 'Rejeitar'}</ThemedText>
                    </Pressable>
                    <Pressable disabled={!!marking} onPress={() => void mark('validated')} style={[s.action, { borderColor: '#059669', backgroundColor: '#059669', opacity: marking ? 0.6 : 1 }]}>
                      <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{marking === 'validated' ? 'Marcando como validado...' : 'Marcar como validado'}</ThemedText>
                    </Pressable>
                  </>
                )}
                {tab === 'validation' && (
                  <>
                    {!isOperational && (
                      <Pressable onPress={() => setExportOpen(true)} style={[s.action, { borderColor: c.border, backgroundColor: c.surface }]}>
                        <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>⬇︎ Exportar Dados</ThemedText>
                      </Pressable>
                    )}
                    <Pressable onPress={() => setFieldsFirst((v) => !v)} style={[s.action, { borderColor: c.border, backgroundColor: c.surface }]}>
                      <ThemedText style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>⇅ {fieldsFirst ? 'Campos primeiro' : 'Trocar layout'}</ThemedText>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {feedback && (
              <Pressable onPress={() => setFeedback(null)} style={[s.feedback, feedback.type === 'error' ? { borderColor: '#fecaca', backgroundColor: c.dark ? 'rgba(220,38,38,0.2)' : '#fef2f2' } : { borderColor: '#a7f3d0', backgroundColor: c.dark ? 'rgba(5,150,105,0.2)' : '#ecfdf5' }]}>
                <ThemedText style={{ fontSize: 13, color: feedback.type === 'error' ? (c.dark ? '#fecaca' : '#b91c1c') : (c.dark ? '#a7f3d0' : '#047857') }}>{feedback.message}</ThemedText>
              </Pressable>
            )}

            {tab === 'validation' && showValidation ? (
              // Painéis como no web: visualizador fixo + campos rolando (ordem trocável).
              <View style={[s.split, { flexDirection: fieldsFirst ? 'column-reverse' : 'column' }]} onTouchStart={() => { metrics.current.taps += 1; }}>
                <View style={s.splitViewer}>{viewer}</View>
                <ScrollView ref={fieldsScrollRef} style={{ flex: 1 }} contentContainerStyle={s.fieldsContent} keyboardShouldPersistTaps="handled">
                  {/* Toque fora de um campo deseleciona (inputs e botões internos capturam o próprio toque). */}
                  <Pressable onPress={() => { Keyboard.dismiss(); setSelectedKey(null); }} style={{ flexGrow: 1 }}>
                    {fields}
                  </Pressable>
                </ScrollView>
              </View>
            ) : (
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
              {tab === 'overview' && <OverviewTab job={job} relatedDocument={relatedDocument} />}
              {tab === 'audit' && (
                <AuditTimeline processJobId={currentJobId} token={token} startedAt={job.startedAt} finishedAt={job.finishedAt} status={String(job.status)} refreshKey={auditRefresh} />
              )}
            </ScrollView>
            )}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        originalResult={originalResult}
        modifiedResult={exportData ?? originalResult}
        hasModifications={hasModificationsVsOriginal}
        onError={(m) => setFeedback({ type: 'error', message: m })}
      />
    </ThemedView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  back: { backgroundColor: '#0891b2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  batch: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  batchItem: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 4, marginHorizontal: 16, padding: 4, borderWidth: 1, borderRadius: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: 'transparent', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 4 },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  action: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  feedback: { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  content: { padding: 16, gap: 14, paddingBottom: 140 },
  split: { flex: 1, paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  splitViewer: { flexShrink: 0 },
  fieldsContent: { flexGrow: 1, paddingBottom: 140 },
});
