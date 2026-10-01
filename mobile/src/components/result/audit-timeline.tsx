import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { palette, useProjectColors } from '@/components/projects/ui';
import { type AuditEvent, ProcessingJobsStatus } from '@/lib/engine/types';
import { resultApi } from '@/lib/result-api';

const TYPE_LABELS: Record<string, string> = {
  file_upload: 'Upload de Arquivo',
  model_selection: 'Seleção de Modelo',
  classifier_selection: 'Seleção de Projeto',
  processing_start: 'Início do Processamento',
  processing_complete: 'Processamento Concluído',
  processing_failed: 'Processamento Falhou',
  field_edit: 'Edição de Campo',
  tab_switch: 'Troca de Aba',
  button_click: 'Clique em Botão',
  export: 'Exportação',
  document_view: 'Visualização de Documento',
  navigation: 'Navegação',
};

const ICONS: Record<string, string> = {
  file_upload: '📤',
  model_selection: '🎯',
  classifier_selection: '🔍',
  processing_start: '▶️',
  processing_complete: '✅',
  processing_failed: '❌',
  field_edit: '✏️',
};

/** Cor do anel do ícone por tipo — dá leitura rápida da linha do tempo. */
const TONES: Record<string, string> = {
  processing_complete: '#10b981',
  processing_failed: '#ef4444',
  field_edit: '#6366f1',
  processing_start: '#06b6d4',
};

const toIso = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Eventos sintéticos quando a API ainda não tem nenhum — mesmo fallback do web. */
function fallbackEvents(id: string, startedAt?: string | null, finishedAt?: string | null, status?: string | null): AuditEvent[] {
  const events: AuditEvent[] = [];
  const start = toIso(startedAt);
  if (start) events.push({ auditEventId: `fallback-start-${id}`, processJobId: id, userId: '', eventType: 'processing_start', description: 'Processing started', elementType: 'system', createdAt: start });
  const end = toIso(finishedAt) ?? start;
  if (end && (status === ProcessingJobsStatus.WaitingValidation || status === ProcessingJobsStatus.Completed || status === ProcessingJobsStatus.Rejected)) {
    events.push({
      auditEventId: `fallback-complete-${id}`,
      processJobId: id,
      userId: '',
      eventType: status === ProcessingJobsStatus.Rejected ? 'processing_failed' : 'processing_complete',
      description: status === ProcessingJobsStatus.WaitingValidation ? 'Processing completed. Waiting for validation' : status === ProcessingJobsStatus.Rejected ? 'Processing rejected' : 'Processing completed',
      elementType: 'system',
      createdAt: end,
    });
  }
  return events.reverse();
}

type Change = { fieldName?: string; oldValue?: unknown; newValue?: unknown };

function EventDetails({ data }: { data: Record<string, unknown> }) {
  const c = useProjectColors();
  const changes = Array.isArray(data.changes) ? (data.changes as Change[]) : null;
  if (changes) {
    return (
      <View style={{ gap: 6 }}>
        {changes.map((ch, i) => (
          <View key={i} style={[s.change, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{String(ch.fieldName ?? '')}</ThemedText>
            <ThemedText style={{ fontSize: 12, color: palette.danger, textDecorationLine: 'line-through' }}>{ch.oldValue == null || ch.oldValue === '' ? '∅' : String(ch.oldValue)}</ThemedText>
            <ThemedText style={{ fontSize: 12, color: palette.success }}>{ch.newValue == null || ch.newValue === '' ? '∅' : String(ch.newValue)}</ThemedText>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[s.pre, { backgroundColor: c.surfaceAlt }]}>
      <ThemedText selectable style={{ fontSize: 11, fontFamily: 'monospace', color: c.text }}>{JSON.stringify(data, null, 2)}</ThemedText>
    </View>
  );
}

export function AuditTimeline({ processJobId, token, startedAt, finishedAt, status, refreshKey }: { processJobId: string; token: string | null; startedAt?: string | null; finishedAt?: string | null; status?: string | null; refreshKey: number }) {
  const c = useProjectColors();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    try {
      const r = await resultApi.auditEvents(token, processJobId);
      setEvents(r.data?.auditEvents ?? r.data?.audit_events ?? []);
      setError(false);
    } catch {
      setError(true);
    }
  }, [processJobId, token]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  // Atualiza enquanto a aba está aberta (o web recebe via stream de jobs).
  useEffect(() => {
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const list = useMemo(() => (events && events.length > 0 ? events : fallbackEvents(processJobId, startedAt, finishedAt, status)), [events, processJobId, startedAt, finishedAt, status]);

  if (!events && !error) return <View style={s.center}><ActivityIndicator color={palette.primary} /><ThemedText style={{ color: c.textMuted }}>Carregando trilha de auditoria...</ThemedText></View>;
  if (error && !events) return <View style={[s.card, { borderColor: '#fecaca', backgroundColor: '#fef2f2' }]}><ThemedText style={{ color: '#991b1b' }}>Falha ao carregar trilha de auditoria.</ThemedText></View>;
  if (list.length === 0) return <View style={[s.card, { borderColor: c.border, backgroundColor: c.surface }]}><ThemedText style={{ color: c.text }}>Nenhum evento de auditoria encontrado para este trabalho de processamento.</ThemedText></View>;

  return (
    <View style={[s.card, { borderColor: c.border, backgroundColor: c.surface }]}>
      <ThemedText style={{ fontSize: 17, fontWeight: '600', color: c.text, marginBottom: 6 }}>{list.length} {list.length === 1 ? 'Evento' : 'Eventos'}</ThemedText>
      {list.map((ev, i) => {
        const last = i === list.length - 1;
        const hasData = !!ev.eventData && Object.keys(ev.eventData).length > 0;
        const expanded = open.has(ev.auditEventId);
        const date = new Date(ev.createdAt);
        return (
          <View key={ev.auditEventId} style={s.item}>
            <View style={s.rail}>
              <View style={[s.icon, { backgroundColor: TONES[ev.eventType] ?? '#06b6d4', borderColor: c.surface }]}>
                <ThemedText style={{ fontSize: 14 }}>{ICONS[ev.eventType] ?? '📋'}</ThemedText>
              </View>
              {!last && <View style={[s.line, { backgroundColor: c.border }]} />}
            </View>
            <View style={[s.body, !last && { paddingBottom: 22 }]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{TYPE_LABELS[ev.eventType] ?? ev.eventType}</ThemedText>
                {!!ev.elementType && <View style={[s.chip, { backgroundColor: c.surfaceAlt }]}><ThemedText style={{ fontSize: 11, fontWeight: '600', color: c.textMuted }}>{ev.elementType}</ThemedText></View>}
              </View>
              <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{Number.isNaN(date.getTime()) ? ev.createdAt : date.toLocaleString('pt-BR')}</ThemedText>
              <ThemedText style={{ fontSize: 13, color: c.textMuted }}>{ev.description}</ThemedText>
              {hasData && (
                <>
                  <Pressable onPress={() => setOpen((prev) => { const n = new Set(prev); if (n.has(ev.auditEventId)) n.delete(ev.auditEventId); else n.add(ev.auditEventId); return n; })} hitSlop={6}>
                    <ThemedText style={{ fontSize: 12, color: '#0891b2', fontWeight: '600' }}>{expanded ? '▾ Ocultar detalhes' : '▸ Ver detalhes'}</ThemedText>
                  </Pressable>
                  {expanded && <EventDetails data={ev.eventData!} />}
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  item: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 34 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  line: { width: 2, flex: 1, marginTop: 2 },
  body: { flex: 1, gap: 3, paddingTop: 5 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  change: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 2 },
  pre: { borderRadius: 8, padding: 8 },
});
