import { useEffect, useState } from 'react';
import { Screen, Card, LoadingOrError } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
export default function DocumentsScreen() {
  const { token } = useAuth(); const [items, setItems] = useState<Record<string, unknown>[]>([]); const [error, setError] = useState<string>();
  useEffect(() => { apiRequest<Record<string, unknown>[]>('/engine/documents', {}, token ?? undefined).then(r => setItems(r.data ?? [])).catch(e => setError(e.message)); }, [token]);
  return <Screen title="Documentos"><LoadingOrError loading={!items.length && !error} error={error} />{items.length === 0 && !error ? null : items.map((item, i) => <Card key={String(item.document_id ?? item.documentId ?? i)}><ThemedText type="smallBold">{String(item.name ?? item.document_name ?? 'Documento')}</ThemedText><ThemedText>{String(item.description ?? 'Modelo de documento')}</ThemedText></Card>)}</Screen>;
}
