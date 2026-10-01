import { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const palette = {
  primary: '#4f46e5',
  primarySoft: '#eef2ff',
  success: '#059669',
  successSoft: '#d1fae5',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  muted: '#6b7280',
};

export function useProjectColors() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    surface: dark ? '#1f2937' : '#ffffff',
    surfaceAlt: dark ? '#111827' : '#f9fafb',
    border: dark ? '#374151' : '#e5e7eb',
    text: dark ? '#f9fafb' : '#111827',
    textMuted: dark ? '#9ca3af' : '#6b7280',
    inputBg: dark ? '#111827' : '#ffffff',
    selectedBg: dark ? 'rgba(79,70,229,0.25)' : '#eef2ff',
  };
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'warning';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  small?: boolean;
  style?: ViewStyle;
}) {
  const c = useProjectColors();
  const bg: Record<ButtonVariant, string> = {
    primary: palette.primary,
    success: palette.success,
    danger: palette.danger,
    warning: c.dark ? 'rgba(180,83,9,0.25)' : palette.warningSoft,
    secondary: 'transparent',
    ghost: 'transparent',
  };
  const fg: Record<ButtonVariant, string> = {
    primary: '#fff',
    success: '#fff',
    danger: '#fff',
    warning: c.dark ? '#fde68a' : '#78350f',
    secondary: c.text,
    ghost: palette.primary,
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg[variant], opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.border },
        variant === 'warning' && { borderWidth: 1, borderColor: '#fcd34d' },
        style,
      ]}>
      {loading ? <ActivityIndicator size="small" color={fg[variant]} /> : icon ? <ThemedText style={{ color: fg[variant], fontSize: small ? 12 : 14 }}>{icon}</ThemedText> : null}
      <ThemedText style={{ color: fg[variant], fontWeight: '600', fontSize: small ? 12 : 14 }}>{label}</ThemedText>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string; hint?: string }) {
  const c = useProjectColors();
  const { label, hint, style, ...rest } = props;
  return (
    <View style={{ gap: 4 }}>
      {label && <ThemedText style={[styles.label, { color: c.textMuted }]}>{label}</ThemedText>}
      <TextInput
        placeholderTextColor={c.textMuted}
        {...rest}
        style={[styles.input, { borderColor: c.border, backgroundColor: c.inputBg, color: c.text }, rest.multiline && styles.multiline, style]}
      />
      {hint && <ThemedText style={[styles.hint, { color: c.textMuted }]}>{hint}</ThemedText>}
    </View>
  );
}

/** Folha modal (bottom sheet em tela cheia no iOS). */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  closeDisabled,
  footer,
  children,
  scroll = true,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  footer?: ReactNode;
  scroll?: boolean;
}>) {
  const c = useProjectColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !closeDisabled && onClose()}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheetHeader, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 17, color: c.text }}>{title}</ThemedText>
              {subtitle && <ThemedText style={[styles.hint, { color: c.textMuted, fontSize: 13 }]}>{subtitle}</ThemedText>}
            </View>
            <Pressable accessibilityLabel="Fechar" disabled={closeDisabled} onPress={onClose} hitSlop={12} style={{ opacity: closeDisabled ? 0.4 : 1 }}>
              <ThemedText style={{ fontSize: 22, color: c.textMuted }}>✕</ThemedText>
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          ) : (
            <View style={[styles.sheetBody, { flex: 1 }]}>{children}</View>
          )}
          {footer && <View style={[styles.sheetFooter, { borderColor: c.border }]}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'gray' | 'amber' | 'green' | 'red' | 'indigo' }) {
  const tones = {
    gray: ['rgba(107,114,128,0.15)', '#4b5563'],
    amber: ['rgba(245,158,11,0.18)', '#92400e'],
    green: ['rgba(16,185,129,0.18)', '#065f46'],
    red: ['rgba(239,68,68,0.18)', '#991b1b'],
    indigo: ['rgba(99,102,241,0.15)', '#4338ca'],
  } as const;
  const [bg, fg] = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={{ color: fg, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{label}</ThemedText>
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} style={[styles.toggle, { backgroundColor: value ? palette.primary : '#d1d5db' }]}>
      <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 20 : 2 }] }]} />
    </Pressable>
  );
}

export function Checkbox({ checked, onPress, children }: PropsWithChildren<{ checked: boolean; onPress: () => void }>) {
  const c = useProjectColors();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={[styles.checkRow, { borderColor: checked ? palette.primary : c.border, backgroundColor: checked ? c.selectedBg : 'transparent' }]}>
      <View style={[styles.checkBox, { borderColor: checked ? palette.primary : c.border, backgroundColor: checked ? palette.primary : 'transparent' }]}>
        {checked && <ThemedText style={{ color: '#fff', fontSize: 11, lineHeight: 14 }}>✓</ThemedText>}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** Placeholder pulsante usado enquanto upload / criação por IA está em andamento. */
export function DocumentSkeleton({ fileName, hint, compact }: { fileName: string; hint?: string; compact?: boolean }) {
  const c = useProjectColors();
  return (
    <View style={[styles.skeleton, { borderColor: c.border, backgroundColor: c.surfaceAlt, minHeight: compact ? 0 : 220 }]}>
      <ActivityIndicator color={palette.primary} />
      <View style={{ flex: compact ? 1 : undefined, alignItems: compact ? 'flex-start' : 'center', gap: 2 }}>
        <ThemedText numberOfLines={1} style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{fileName}</ThemedText>
        {hint && <ThemedText style={{ color: palette.primary, fontSize: 12 }}>{hint}</ThemedText>}
      </View>
    </View>
  );
}

export type Toast = { status: 'success' | 'error'; message: string };

export function ToastBanner({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  if (!toast) return null;
  const ok = toast.status === 'success';
  return (
    <Pressable onPress={onDismiss} style={[styles.toast, { backgroundColor: ok ? palette.success : palette.danger }]}>
      <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 13, flex: 1 }}>{toast.message}</ThemedText>
      <ThemedText style={{ color: '#fff' }}>✕</ThemedText>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10 },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: 12, lineHeight: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetBody: { padding: 16, gap: 12 },
  sheetFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 12 },
  checkBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  skeleton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 12 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 10 },
});
