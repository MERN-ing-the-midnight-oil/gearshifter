// Printer connection component for UI
// Allows users to scan, connect, and manage thermal printer

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { usePrinter } from '../hardware/usePrinter';

export default function PrinterConnection() {
  const {
    status,
    devices,
    isScanning,
    scanForPrinters,
    connect,
    disconnect,
    printTest,
    clearError,
  } = usePrinter();

  // Auto-scan on mount
  useEffect(() => {
    scanForPrinters();
  }, []);

  const handleConnect = async (device: typeof devices[0]) => {
    const success = await connect(device);
    if (success) {
      Alert.alert('Success', `Connected to ${device.name}`);
    } else {
      Alert.alert('Error', status.error || 'Failed to connect to printer');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    Alert.alert('Disconnected', 'Printer disconnected');
  };

  const handleTestPrint = async () => {
    const success = await printTest();
    if (success) {
      Alert.alert('Success', 'Test print sent to printer');
    } else {
      Alert.alert('Error', status.error || 'Test print failed');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thermal Printer</Text>
        <Text style={styles.subtitle}>
          Connect to Phomemo M110 or other ESC/POS printer
        </Text>
      </View>

      {/* Connection Status */}
      <View style={styles.section}>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIndicator,
              status.isConnected ? styles.statusConnected : styles.statusDisconnected,
            ]}
          />
          <Text style={styles.statusText}>
            {status.isConnected
              ? `Connected: ${status.currentDevice?.name || 'Unknown'}`
              : 'Not Connected'}
          </Text>
        </View>

        {status.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{status.error}</Text>
            <TouchableOpacity onPress={clearError} style={styles.dismissButton}>
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {status.isConnected && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={handleTestPrint}
              disabled={status.isPrinting}
            >
              {status.isPrinting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Print Test Page</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={handleDisconnect}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Device List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Printers</Text>
          <TouchableOpacity
            onPress={scanForPrinters}
            disabled={isScanning}
            style={styles.scanButton}
          >
            {isScanning ? (
              <ActivityIndicator color="#007AFF" size="small" />
            ) : (
              <Text style={styles.scanButtonText}>Scan</Text>
            )}
          </TouchableOpacity>
        </View>

        {isScanning && devices.length === 0 && (
          <View style={styles.scanningContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Scanning for printers...</Text>
          </View>
        )}

        {!isScanning && devices.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No printers found</Text>
            <Text style={styles.emptySubtext}>
              Make sure your printer is turned on and Bluetooth is enabled
            </Text>
          </View>
        )}

        {devices.length > 0 && (
          <View style={styles.deviceList}>
            {devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={[
                  styles.deviceCard,
                  status.currentDevice?.id === device.id && styles.deviceCardActive,
                ]}
                onPress={() => handleConnect(device)}
                disabled={status.isConnected && status.currentDevice?.id === device.id}
              >
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceAddress}>{device.address}</Text>
                </View>
                {status.currentDevice?.id === device.id && (
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>Connected</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={styles.infoTitle}>Printer Information</Text>
        <Text style={styles.infoText}>
          • Supported printers: Phomemo M110 and other ESC/POS compatible thermal printers
        </Text>
        <Text style={styles.infoText}>
          • Make sure Bluetooth is enabled on your device
        </Text>
        <Text style={styles.infoText}>
          • Keep the printer within range (typically 10 meters)
        </Text>
        <Text style={styles.infoText}>
          • If connection fails, try turning the printer off and on again
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusConnected: {
    backgroundColor: '#34C759',
  },
  statusDisconnected: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  errorContainer: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
  },
  dismissButton: {
    marginLeft: 12,
  },
  dismissButtonText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButton: {
    backgroundColor: '#007AFF',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  scanButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scanButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningContainer: {
    padding: 40,
    alignItems: 'center',
  },
  scanningText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  deviceList: {
    gap: 12,
  },
  deviceCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceCardActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  deviceAddress: {
    fontSize: 14,
    color: '#666',
  },
  connectedBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});

