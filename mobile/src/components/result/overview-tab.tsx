import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useProjectColors } from '@/components/projects/ui';
import { fieldEntriesWithoutConfidence, formatConfidencePercent, parseExtractionConfidence } from '@/lib/engine/extractionResult';
import { tableColumns } from '@/lib/engine/tableFieldValues';
import { type Field, type ProcessingJob, ProcessingJobsStatus } from '@/lib/engine/types';
import type { ClassDocument } from '@/lib/projects';

export const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído',
  failed: 'Falhou',
  rejected: 'Rejeitado',
  processing: 'Processando',
  waiting_validation: 'Aguardando validação',
};

export function statusColors(status: string, dark: boolean) {
  switch (status) {
    case ProcessingJobsStatus.Completed: return dark ? ['rgba(22,163,74,0.3)', '#bbf7d0'] : ['#dcfce7', '#166534'];
    case ProcessingJobsStatus.Failed: return dark ? ['rgba(220,38,38,0.3)', '#fecaca'] : ['#fee2e2', '#991b1b'];
    case ProcessingJobsStatus.Rejected: return dark ? ['rgba(225,29,72,0.3)', '#fecdd3'] : ['#ffe4e6', '#9f1239'];
    default: return dark ? ['rgba(202,138,4,0.3)', '#fef08a'] : ['#fef9c3', '#854d0e'];
  }
}

const formatLabel = (key: string) => key.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (ch) => ch.toUpperCase());
const formatValue = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));

function ReadOnlyTable({ field, rows }: { field: Field; rows: unknown[] }) {
  const c = useProjectColors();
  const columns = tableColumns(field);
  if (rows.length === 0) return <ThemedText style={{ fontSize: 13, color: c.textMuted }}>Nenhuma linha extraída</ThemedText>;
  return (
    <ScrollView horizontal>
      <View>
        <View style={[s.tr, { borderColor: c.border }]}>
          {columns.map((col) => <ThemedText key={col.columnName} style={[s.td, s.th, { color: c.textMuted }]}>{col.displayName || col.columnName}</ThemedText>)}
        </View>
        {rows.map((row, i) => {
          const cells = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
          return (
            <View key={i} style={[s.tr, { borderColor: c.border }]}>
              {columns.map((col) => (
                <ThemedText key={col.columnName} style={[s.td, { color: c.text }]}>
                  {cells[col.columnName] === null || cells[col.columnName] === undefined || cells[col.columnName] === '' ? '-' : String(cells[col.columnName])}
                </ThemedText>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function OverviewTab({ job, relatedDocument }: { job: ProcessingJob; relatedDocument?: ClassDocument }) {
  const c = useProjectColors();
  const [view, setView] = useState<'beauty' | 'raw'>('beauty');
  const [copied, setCopied] = useState(false);
  const isPrompt = String(relatedDocument?.documentProcessMethod ?? '').toLowerCase() === 'prompt' || relatedDocument?.documentProcessMethod === 2;
  const started = job.startedAt ? new Date(job.startedAt) : undefined;
  const finished = job.finishedAt ? new Date(job.finishedAt) : undefined;
  const durationMs = started && finished ? finished.getTime() - started.getTime() : undefined;
  const result = job.result && typeof job.result === 'object' && !Array.isArray(job.result) ? job.result : null;
  const entries = useMemo(() => (result ? fieldEntriesWithoutConfidence(result) : []), [result]);
  const confidence = parseExtractionConfidence(result);
  const formatted = useMemo(() => JSON.stringify(job.result ?? null, null, 2), [job.result]);
  const tables = useMemo(() => new Map((relatedDocument?.fields ?? []).filter((f) => f.fieldType === 'table').map((f) => [f.fieldName, f])), [relatedDocument?.fields]);
  const [bg, fg] = statusColors(String(job.status), c.dark);

  const copy = async () => {
    await Clipboard.setStringAsync(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const stat = (label: string, value: string, bold?: boolean) => (
    <View style={[s.stat, { backgroundColor: c.surfaceAlt }]}>
      <ThemedText style={{ fontSize: 11, color: c.textMuted }}>{label}</ThemedText>
      <ThemedText style={{ fontSize: 14, color: c.text, fontWeight: bold ? '700' : '400' }}>{value}</ThemedText>
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      <View style={[s.card, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Trabalho {job.processJobId}</ThemedText>
            <ThemedText style={{ fontSize: 13, color: c.textMuted }}>ID do Documento: {job.documentId ?? '-'} • Páginas: {job.pagesCount ?? '-'}</ThemedText>
          </View>
          <View style={[s.badge, { backgroundColor: bg }]}><ThemedText style={{ fontSize: 11, fontWeight: '700', color: fg }}>{job.status}</ThemedText></View>
        </View>
        <View style={s.grid}>
          {stat('Iniciado', started ? started.toLocaleString('pt-BR') : '-')}
          {stat('Finalizado', finished ? finished.toLocaleString('pt-BR') : '-')}
          {stat('Duração', durationMs !== undefined ? `${Math.round(durationMs / 1000)}s` : '-')}
          {confidence !== null && stat('Confiança da extração', formatConfidencePercent(confidence), true)}
        </View>
      </View>

      <View style={[s.card, { borderColor: c.border, backgroundColor: c.surface }]}>
        <ThemedText style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Detalhes do Documento</ThemedText>
        {!relatedDocument ? (
          <ThemedText style={{ fontSize: 13, color: c.textMuted }}>Metadados do documento não encontrados.</ThemedText>
        ) : (
          <View style={s.grid}>
            {stat('ID do Documento', relatedDocument.documentId)}
            {stat('Tipo', relatedDocument.displayName)}
            {stat(
              isPrompt ? 'Prompt' : 'Campos',
              isPrompt
                ? relatedDocument.prompt ? `${relatedDocument.prompt.slice(0, 80)}${relatedDocument.prompt.length > 80 ? '…' : ''}` : 'Não definido'
                : String(relatedDocument.fields?.length ?? 0),
            )}
          </View>
        )}
      </View>

      <View style={[s.card, { borderColor: c.border, backgroundColor: c.surface, padding: 0 }]}>
        <View style={[s.resultHeader, { borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Resultado Extraído</ThemedText>
            <ThemedText style={{ fontSize: 12, color: c.textMuted }}>{entries.length} campos extraídos</ThemedText>
          </View>
          <View style={[s.segment, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
            {(['beauty', 'raw'] as const).map((v) => (
              <Pressable key={v} onPress={() => setView(v)} style={[s.segItem, view === v && { backgroundColor: c.surface }]}>
                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: view === v ? '#0e7490' : c.textMuted }}>{v === 'beauty' ? '▦ Bonito' : '</> Raw'}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => void copy()} style={[s.copy, { borderColor: c.border }]}>
            <ThemedText style={{ fontSize: 12, fontWeight: '600', color: copied ? '#16a34a' : c.text }}>{copied ? '✓ Copiado' : '⧉ Copiar JSON'}</ThemedText>
          </Pressable>
        </View>
        <View style={{ padding: 12, gap: 10 }}>
          {view === 'beauty' && entries.length > 0 ? (
            entries.map(([key, value]) => {
              const tf = tables.get(key);
              return (
                <View key={key} style={[s.entry, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: c.textMuted }}>{formatLabel(key)}</ThemedText>
                    <View style={[s.code, { backgroundColor: c.surface }]}><ThemedText style={{ fontSize: 10, fontFamily: 'monospace', color: c.textMuted }}>{key}</ThemedText></View>
                  </View>
                  {tf && Array.isArray(value) ? <ReadOnlyTable field={tf} rows={value} /> : <ThemedText selectable style={{ fontSize: 14, fontWeight: '500', color: c.text }}>{formatValue(value)}</ThemedText>}
                </View>
              );
            })
          ) : (
            <ScrollView horizontal style={s.raw}>
              <ThemedText selectable style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 20, color: '#f3f4f6' }}>{formatted}</ThemedText>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, flexBasis: '45%', borderRadius: 8, padding: 10, gap: 2 },
  resultHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, padding: 3 },
  segItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  copy: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  entry: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 6 },
  code: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  raw: { backgroundColor: '#030712', borderRadius: 8, padding: 12, maxHeight: 480 },
  tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  td: { width: 130, paddingHorizontal: 6, paddingVertical: 5, fontSize: 13 },
  th: { fontSize: 11, fontWeight: '700' },
});
