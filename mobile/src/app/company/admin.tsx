import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Card, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

const sections = [
  ['/company', 'Empresa e membros', 'Consultar empresa, convidar pessoas e abrir detalhes de membros.'],
  ['/classifiers', 'Projetos e classificadores', 'Consultar e administrar os projetos de classificação da empresa.'],
  ['/groups', 'Grupos', 'Criar e remover grupos de acesso.'],
  ['/assignments', 'Atribuições', 'Consultar classes e responsáveis.'],
  ['/integrations', 'Integrações', 'Conectar Google Drive e configurar conexões de armazenamento.'],
  ['/activity', 'Atividade', 'Acompanhar o histórico de ações da empresa.'],
  ['/analytics', 'Analytics', 'Consultar indicadores operacionais da empresa.'],
] as const;

export default function CompanyAdminScreen() {
  return <Screen title="Administração da empresa"><ThemedText>Escolha uma área para administrar os recursos da sua empresa.</ThemedText>{sections.map(([path, title, description]) => <Pressable key={path} onPress={() => router.push(path)}><Card><ThemedText type="smallBold">{title}</ThemedText><ThemedText>{description}</ThemedText><ThemedText style={styles.link}>Abrir</ThemedText></Card></Pressable>)}</Screen>;
}
const styles = StyleSheet.create({ link: { color: '#2563eb', fontWeight: '700' } });
