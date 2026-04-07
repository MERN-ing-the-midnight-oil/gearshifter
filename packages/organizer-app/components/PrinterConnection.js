"use strict";
// Printer connection component for UI
// Allows users to scan, connect, and manage thermal printer
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PrinterConnection;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const usePrinter_1 = require("../hardware/usePrinter");
function PrinterConnection() {
    const { status, devices, isScanning, scanForPrinters, connect, disconnect, printTest, clearError, } = (0, usePrinter_1.usePrinter)();
    // Auto-scan on mount
    (0, react_1.useEffect)(() => {
        scanForPrinters();
    }, []);
    const handleConnect = async (device) => {
        const success = await connect(device);
        if (success) {
            react_native_1.Alert.alert('Success', `Connected to ${device.name}`);
        }
        else {
            react_native_1.Alert.alert('Error', status.error || 'Failed to connect to printer');
        }
    };
    const handleDisconnect = async () => {
        await disconnect();
        react_native_1.Alert.alert('Disconnected', 'Printer disconnected');
    };
    const handleTestPrint = async () => {
        const success = await printTest();
        if (success) {
            react_native_1.Alert.alert('Success', 'Test print sent to printer');
        }
        else {
            react_native_1.Alert.alert('Error', status.error || 'Test print failed');
        }
    };
    return (<react_native_1.ScrollView style={styles.container}>
      <react_native_1.View style={styles.header}>
        <react_native_1.Text style={styles.title}>Thermal Printer</react_native_1.Text>
        <react_native_1.Text style={styles.subtitle}>
          Connect to Phomemo M110 or other ESC/POS printer
        </react_native_1.Text>
      </react_native_1.View>

      {/* Connection Status */}
      <react_native_1.View style={styles.section}>
        <react_native_1.View style={styles.statusContainer}>
          <react_native_1.View style={[
            styles.statusIndicator,
            status.isConnected ? styles.statusConnected : styles.statusDisconnected,
        ]}/>
          <react_native_1.Text style={styles.statusText}>
            {status.isConnected
            ? `Connected: ${status.currentDevice?.name || 'Unknown'}`
            : 'Not Connected'}
          </react_native_1.Text>
        </react_native_1.View>

        {status.error && (<react_native_1.View style={styles.errorContainer}>
            <react_native_1.Text style={styles.errorText}>{status.error}</react_native_1.Text>
            <react_native_1.TouchableOpacity onPress={clearError} style={styles.dismissButton}>
              <react_native_1.Text style={styles.dismissButtonText}>Dismiss</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>)}

        {status.isConnected && (<react_native_1.View style={styles.actionsContainer}>
            <react_native_1.TouchableOpacity style={[styles.button, styles.testButton]} onPress={handleTestPrint} disabled={status.isPrinting}>
              {status.isPrinting ? (<react_native_1.ActivityIndicator color="#FFFFFF"/>) : (<react_native_1.Text style={styles.buttonText}>Print Test Page</react_native_1.Text>)}
            </react_native_1.TouchableOpacity>
            <react_native_1.TouchableOpacity style={[styles.button, styles.disconnectButton]} onPress={handleDisconnect}>
              <react_native_1.Text style={styles.buttonText}>Disconnect</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>)}
      </react_native_1.View>

      {/* Device List */}
      <react_native_1.View style={styles.section}>
        <react_native_1.View style={styles.sectionHeader}>
          <react_native_1.Text style={styles.sectionTitle}>Available Printers</react_native_1.Text>
          <react_native_1.TouchableOpacity onPress={scanForPrinters} disabled={isScanning} style={styles.scanButton}>
            {isScanning ? (<react_native_1.ActivityIndicator color="#007AFF" size="small"/>) : (<react_native_1.Text style={styles.scanButtonText}>Scan</react_native_1.Text>)}
          </react_native_1.TouchableOpacity>
        </react_native_1.View>

        {isScanning && devices.length === 0 && (<react_native_1.View style={styles.scanningContainer}>
            <react_native_1.ActivityIndicator size="large" color="#007AFF"/>
            <react_native_1.Text style={styles.scanningText}>Scanning for printers...</react_native_1.Text>
          </react_native_1.View>)}

        {!isScanning && devices.length === 0 && (<react_native_1.View style={styles.emptyContainer}>
            <react_native_1.Text style={styles.emptyText}>No printers found</react_native_1.Text>
            <react_native_1.Text style={styles.emptySubtext}>
              Make sure your printer is turned on and Bluetooth is enabled
            </react_native_1.Text>
          </react_native_1.View>)}

        {devices.length > 0 && (<react_native_1.View style={styles.deviceList}>
            {devices.map((device) => (<react_native_1.TouchableOpacity key={device.id} style={[
                    styles.deviceCard,
                    status.currentDevice?.id === device.id && styles.deviceCardActive,
                ]} onPress={() => handleConnect(device)} disabled={status.isConnected && status.currentDevice?.id === device.id}>
                <react_native_1.View style={styles.deviceInfo}>
                  <react_native_1.Text style={styles.deviceName}>{device.name}</react_native_1.Text>
                  <react_native_1.Text style={styles.deviceAddress}>{device.address}</react_native_1.Text>
                </react_native_1.View>
                {status.currentDevice?.id === device.id && (<react_native_1.View style={styles.connectedBadge}>
                    <react_native_1.Text style={styles.connectedBadgeText}>Connected</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.TouchableOpacity>))}
          </react_native_1.View>)}
      </react_native_1.View>

      {/* Info Section */}
      <react_native_1.View style={styles.section}>
        <react_native_1.Text style={styles.infoTitle}>Printer Information</react_native_1.Text>
        <react_native_1.Text style={styles.infoText}>
          • Supported printers: Phomemo M110 and other ESC/POS compatible thermal printers
        </react_native_1.Text>
        <react_native_1.Text style={styles.infoText}>
          • Make sure Bluetooth is enabled on your device
        </react_native_1.Text>
        <react_native_1.Text style={styles.infoText}>
          • Keep the printer within range (typically 10 meters)
        </react_native_1.Text>
        <react_native_1.Text style={styles.infoText}>
          • If connection fails, try turning the printer off and on again
        </react_native_1.Text>
      </react_native_1.View>
    </react_native_1.ScrollView>);
}
const styles = react_native_1.StyleSheet.create({
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
