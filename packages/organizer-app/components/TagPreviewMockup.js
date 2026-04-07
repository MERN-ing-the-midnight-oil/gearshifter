"use strict";
// Real-time tag preview with flow layout and word wrap
// Shows tag fields in order with correct aspect ratio for selected label size
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TagPreviewMockup;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const MM_TO_PX = 3.779527559; // 1mm ≈ 3.78px at 96 DPI
const MAX_PREVIEW_WIDTH = 280;
function TagPreviewMockup({ widthMm, heightMm, tagFields, qrCodePosition, qrCodeSize, availableFields, }) {
    const aspectRatio = heightMm / widthMm;
    const previewWidth = Math.min(MAX_PREVIEW_WIDTH, react_native_1.Dimensions.get('window').width - 48);
    const previewHeight = previewWidth * aspectRatio;
    const getFieldDisplayInfo = (field) => {
        const fieldInfo = availableFields.find((f) => f.name === field.field);
        return {
            label: field.label || fieldInfo?.defaultLabel || fieldInfo?.label || field.field,
            fontSize: field.fontSize || 10,
            maxLength: field.maxLength ?? 30,
        };
    };
    // Scale factor from mm to preview pixels
    const scale = previewWidth / (widthMm * MM_TO_PX);
    const qrSizePx = Math.min(qrCodeSize * MM_TO_PX * scale, previewWidth * 0.35);
    const paddingPx = 6;
    const isQrLeft = qrCodePosition === 'top-left' || qrCodePosition === 'bottom-left';
    const isQrRight = qrCodePosition === 'top-right' || qrCodePosition === 'bottom-right';
    const isQrTop = qrCodePosition === 'top-left' || qrCodePosition === 'top-right';
    const isQrBottom = qrCodePosition === 'bottom-left' || qrCodePosition === 'bottom-right';
    const isCenterQR = qrCodePosition === 'center';
    const contentPadding = {
        padding: paddingPx,
        paddingLeft: isQrLeft ? qrSizePx + paddingPx : paddingPx,
        paddingRight: isQrRight ? qrSizePx + paddingPx : paddingPx,
        paddingTop: isQrTop ? qrSizePx + paddingPx : paddingPx,
        paddingBottom: isQrBottom ? qrSizePx + paddingPx : paddingPx,
    };
    const contentMaxWidth = previewWidth - contentPadding.paddingLeft - contentPadding.paddingRight;
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Text style={styles.title}>Tag Preview</react_native_1.Text>
      <react_native_1.Text style={styles.subtitle}>
        {widthMm}mm × {heightMm}mm
      </react_native_1.Text>
      <react_native_1.View style={[
            styles.tagOuter,
            {
                width: previewWidth,
                height: previewHeight,
            },
        ]}>
        <react_native_1.View style={[styles.tagInner, { width: previewWidth, height: previewHeight }]}>
          {/* Content area: fields flow with word wrap */}
          <react_native_1.View style={[styles.contentArea, contentPadding]}>
            {tagFields.map((field, index) => {
            const { label, fontSize, maxLength } = getFieldDisplayInfo(field);
            const scaledFontSize = Math.max(8, fontSize * scale * 0.9);
            const sampleValue = 'X'.repeat(Math.min(maxLength, 16));
            const displayText = `${label}: ${sampleValue}`;
            return (<react_native_1.Text key={index} style={[
                    styles.fieldText,
                    {
                        fontSize: scaledFontSize,
                        fontWeight: field.fontWeight === 'bold' ? 'bold' : 'normal',
                        maxWidth: contentMaxWidth,
                    },
                ]} numberOfLines={3}>
                  {displayText}
                </react_native_1.Text>);
        })}
          </react_native_1.View>

          {/* QR code placeholder */}
          <react_native_1.View style={[
            styles.qrCode,
            {
                width: qrSizePx,
                height: qrSizePx,
                ...(isCenterQR
                    ? {
                        top: (previewHeight - qrSizePx) / 2,
                        left: (previewWidth - qrSizePx) / 2,
                    }
                    : {
                        top: isQrTop ? paddingPx : undefined,
                        bottom: isQrBottom ? paddingPx : undefined,
                        left: isQrLeft ? paddingPx : undefined,
                        right: isQrRight ? paddingPx : undefined,
                    }),
            },
        ]}>
            <react_native_1.Text style={styles.qrText}>QR</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginVertical: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    tagOuter: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#E5E5E5',
        borderStyle: 'solid',
        borderRadius: 8,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tagInner: {
        flex: 1,
        position: 'relative',
    },
    contentArea: {
        flex: 1,
        flexDirection: 'column',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        alignContent: 'flex-start',
    },
    fieldText: {
        color: '#1A1A1A',
        marginBottom: 2,
        ...(react_native_1.Platform.OS === 'web' && { wordBreak: 'break-word' }),
    },
    qrCode: {
        position: 'absolute',
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: '#CCCCCC',
        borderStyle: 'dashed',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrText: {
        fontSize: 10,
        color: '#999',
        fontWeight: 'bold',
    },
});
