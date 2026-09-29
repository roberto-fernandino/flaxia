import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { apiRequest } from '@/lib/api';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
export default function EmailVerificationScreen() { const { token } = useAuth(); const [code, setCode] = useState(''); const [message, setMessage] = useState<string>(); async function verify() { try { const r = await apiRequest('/users/email-verification/verify', { method: 'POST', body: JSON.stringify({ code }) }, token ?? undefined); setMessage(r.message ?? 'E-mail verificado.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Código inválido.'); } } return <Screen title="Verificar e-mail"><ThemedText>Informe o código enviado para seu e-mail.</ThemedText><TextInput value={code} onChangeText={setCode} placeholder="Código" keyboardType="number-pad" style={styles.input} /><Pressable onPress={verify} style={styles.button}><ThemedText style={styles.white}>Verificar</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}</Screen>; }
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, button: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
