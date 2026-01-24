import { View, Text, StyleSheet } from 'react-native';

export default function SelectModeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Station Mode</Text>
      <Text style={styles.subtitle}>Choose check-in, POS, or pickup station</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

