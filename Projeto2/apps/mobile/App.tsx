import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const theme = {
  background: '#07030a',
  backgroundAlt: '#140018',
  surface: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.12)',
  text: '#f8eaf2',
  textStrong: '#ffffff',
  textMuted: '#bfa6b4',
  accent: '#ff2e88',
  gold: '#f5c46b',
};

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>LOVIX • mobile</Text>
        </View>

        <Text style={styles.title}>Base visual unificada</Text>
        <Text style={styles.subtitle}>
          O app mobile agora já começa com a mesma linguagem dark premium do web,
          facilitando a evolução de um design system único para o projeto.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,196,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,196,107,0.25)',
  },
  badgeText: {
    color: theme.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.textStrong,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 320,
    color: theme.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
});
