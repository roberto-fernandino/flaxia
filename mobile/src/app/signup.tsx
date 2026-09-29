/* eslint-disable @typescript-eslint/array-type */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
export default function SignupScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId?: string }>(); const { signIn } = useAuth(); const [form, setForm] = useState({ firstName: '', lastName: '', email: '', telefone: '', cpfCnpj: '', password: '', confirm: '' }); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  async function submit() { if (form.password !== form.confirm) { setMessage('As senhas não coincidem.'); return; } setBusy(true); try { const r = await apiRequest<{ token?: string }>('/users/signup', { method: 'POST', body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, telefone: form.telefone.replace(/\D/g, ''), cpfCnpj: form.cpfCnpj.replace(/\D/g, ''), password: form.password, inviteId }) }); if (r.data?.token) { await signIn(form.email, form.password); } else { setMessage(r.message ?? 'Cadastro realizado.'); router.back(); } } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha no cadastro.'); } finally { setBusy(false); } }
  const fields: Array<[keyof typeof form, string]> = [['firstName', 'Nome'], ['lastName', 'Sobrenome'], ['email', 'E-mail'], ['telefone', 'Telefone'], ['cpfCnpj', 'CPF/CNPJ'], ['password', 'Senha'], ['confirm', 'Confirmar senha']];
  return <Screen title="Criar conta">{fields.map(([key, placeholder]) => <TextInput key={key} secureTextEntry={key === 'password' || key === 'confirm'} value={form[key]} onChangeText={(v) => set(key, v)} placeholder={placeholder} style={styles.input} autoCapitalize={key === 'email' ? 'none' : 'sentences'} keyboardType={key === 'email' ? 'email-address' : 'default'} />)}<Pressable disabled={busy} onPress={submit} style={styles.button}><ThemedText style={styles.white}>{busy ? 'Criando...' : 'Criar conta'}</ThemedText></Pressable><Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Voltar ao login</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}</Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, button: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
