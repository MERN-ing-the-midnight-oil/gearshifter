// Real-time tag preview with flow layout and word wrap
// Shows tag fields in order with correct aspect ratio for selected label size

import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import type { TagField, QRCodePosition } from 'shared';

const MM_TO_PX = 3.779527559; // 1mm ≈ 3.78px at 96 DPI
const MAX_PREVIEW_WIDTH = 280;

interface TagPreviewMockupProps {
  widthMm: number;
  heightMm: number;
  tagFields: TagField[];
  qrCodePosition: QRCodePosition;
  qrCodeSize: number;
  availableFields: Array<{ name: string; label: string; defaultLabel?: string }>;
}

export default function TagPreviewMockup({
  widthMm,
  heightMm,
  tagFields,
  qrCodePosition,
  qrCodeSize,
  availableFields,
}: TagPreviewMockupProps) {
  const aspectRatio = heightMm / widthMm;
  const previewWidth = Math.min(MAX_PREVIEW_WIDTH, Dimensions.get('window').width - 48);
  const previewHeight = previewWidth * aspectRatio;

  const getFieldDisplayInfo = (field: TagField) => {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tag Preview</Text>
      <Text style={styles.subtitle}>
        {widthMm}mm × {heightMm}mm
      </Text>
      <View
        style={[
          styles.tagOuter,
          {
            width: previewWidth,
            height: previewHeight,
          },
        ]}
      >
        <View style={[styles.tagInner, { width: previewWidth, height: previewHeight }]}>
          {/* Content area: fields flow with word wrap */}
          <View style={[styles.contentArea, contentPadding]}>
            {tagFields.map((field, index) => {
              const { label, fontSize, maxLength } = getFieldDisplayInfo(field);
              const scaledFontSize = Math.max(8, fontSize * scale * 0.9);
              const sampleValue = 'X'.repeat(Math.min(maxLength, 16));
              const displayText = `${label}: ${sampleValue}`;

              return (
                <Text
                  key={index}
                  style={[
                    styles.fieldText,
                    {
                      fontSize: scaledFontSize,
                      fontWeight: field.fontWeight === 'bold' ? 'bold' : 'normal',
                      maxWidth: contentMaxWidth,
                    },
                  ]}
                  numberOfLines={3}
                >
                  {displayText}
                </Text>
              );
            })}
          </View>

          {/* QR code placeholder */}
          <View
            style={[
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
            ]}
          >
            <Text style={styles.qrText}>QR</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    ...(Platform.OS === 'web' && { wordBreak: 'break-word' as const }),
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
