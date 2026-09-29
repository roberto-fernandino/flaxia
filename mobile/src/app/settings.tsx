import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
export default function SettingsScreen() {
  const { token } = useAuth(); const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState(false);
  async function changePassword() { if (!current || !next || next !== confirm) { setMessage('Confira as senhas informadas.'); return; } setBusy(true); try { const r = await apiRequest('/users/password', { method: 'PUT', body: JSON.stringify({ currentPassword: current, newPassword: next }) }, token ?? undefined); setMessage(r.message ?? 'Senha alterada com sucesso.'); setCurrent(''); setNext(''); setConfirm(''); } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao alterar senha.'); } finally { setBusy(false); } }
  return <Screen title="Configurações"><ThemedText type="subtitle">Alterar senha</ThemedText><TextInput secureTextEntry value={current} onChangeText={setCurrent} placeholder="Senha atual" style={styles.input} /><TextInput secureTextEntry value={next} onChangeText={setNext} placeholder="Nova senha" style={styles.input} /><TextInput secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="Confirmar nova senha" style={styles.input} /><Pressable disabled={busy} onPress={changePassword} style={styles.button}><ThemedText style={styles.white}>{busy ? 'Salvando...' : 'Alterar senha'}</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, button: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
