import { View, Text, StyleSheet } from 'react-native';

export default function ItemsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Items</Text>
      <Text style={styles.subtitle}>Your consigned items will appear here</Text>
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

