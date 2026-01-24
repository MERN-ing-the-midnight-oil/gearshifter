import { View, Text, StyleSheet } from 'react-native';

export default function CheckInScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-In Station</Text>
      <Text style={styles.subtitle}>Scan seller QR code to begin</Text>
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

