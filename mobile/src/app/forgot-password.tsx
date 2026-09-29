import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { apiRequest } from '@/lib/api';
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [message, setMessage] = useState<string>();
  async function reset() { if (password.length < 8 || password !== confirm) { setMessage('A nova senha deve ter 8 caracteres e coincidir.'); return; } try { const r = await apiRequest('/users/password-reset/confirm', { method: 'POST', body: JSON.stringify({ email, code, newPassword: password }) }); setMessage(r.message ?? 'Senha redefinida.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Código inválido ou expirado.'); } }
  return <Screen title="Recuperar senha"><ThemedText>Solicite o código pelo canal de recuperação da organização e informe-o aqui.</ThemedText><TextInput value={email} onChangeText={setEmail} placeholder="E-mail" keyboardType="email-address" autoCapitalize="none" style={styles.input} /><TextInput value={code} onChangeText={setCode} placeholder="Código de 6 dígitos" keyboardType="number-pad" style={styles.input} /><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Nova senha" style={styles.input} /><TextInput secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="Confirmar nova senha" style={styles.input} /><Pressable onPress={reset} style={styles.button}><ThemedText style={styles.white}>Redefinir senha</ThemedText></Pressable>{message && <ThemedText>{message}</ThemedText>}<Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Voltar ao login</ThemedText></Pressable></Screen>;
}
const styles = StyleSheet.create({ input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, backgroundColor: '#fff' }, button: { padding: 14, borderRadius: 10, backgroundColor: '#208AEF', alignItems: 'center' }, white: { color: '#fff', fontWeight: '700' } });
