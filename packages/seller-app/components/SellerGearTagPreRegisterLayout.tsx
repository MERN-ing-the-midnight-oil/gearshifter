/**
 * Tag-shaped shell for seller pre-register, matching organizer TagPreviewMockup
 * (aspect ratio, padding, QR placeholder, field order).
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import type { TagField, QRCodePosition } from 'shared';

const MM_TO_PX = 3.779527559;
const MAX_PREVIEW_WIDTH = 320;

export type TagFieldMeta = { name: string; label: string; defaultLabel?: string };

type SellerGearTagPreRegisterLayoutProps = {
  widthMm: number;
  heightMm: number;
  tagFields: TagField[];
  qrCodePosition: QRCodePosition;
  qrCodeSize: number;
  qrCodeEnabled: boolean;
  availableFields: TagFieldMeta[];
  templateName?: string;
  /** `displayLabel` is for seller-facing copy; omit it on the tag preview when `tagField.hideLabelOnTag` is true. */
  renderSlot: (tagField: TagField, displayLabel: string, labelFontSize: number) => React.ReactNode;
};

function displayLabelForTagField(field: TagField, availableFields: TagFieldMeta[]): string {
  const fieldInfo = availableFields.find((f) => f.name === field.field);
  return field.label || fieldInfo?.defaultLabel || fieldInfo?.label || field.field;
}

export default function SellerGearTagPreRegisterLayout({
  widthMm,
  heightMm,
  tagFields,
  qrCodePosition,
  qrCodeSize,
  qrCodeEnabled,
  availableFields,
  templateName,
  renderSlot,
}: SellerGearTagPreRegisterLayoutProps) {
  const aspectRatio = heightMm / widthMm;
  const previewWidth = Math.min(MAX_PREVIEW_WIDTH, Dimensions.get('window').width - 40);
  const previewHeight = previewWidth * aspectRatio;
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
    paddingLeft: isQrLeft && qrCodeEnabled ? qrSizePx + paddingPx : paddingPx,
    paddingRight: isQrRight && qrCodeEnabled ? qrSizePx + paddingPx : paddingPx,
    paddingTop: isQrTop && qrCodeEnabled ? qrSizePx + paddingPx : paddingPx,
    paddingBottom: isQrBottom && qrCodeEnabled ? qrSizePx + paddingPx : paddingPx,
  };

  const contentMaxW = previewWidth - contentPadding.paddingLeft - contentPadding.paddingRight;

  return (
    <View style={styles.container}>
      {templateName ? (
        <Text style={styles.templateName} numberOfLines={1}>
          {templateName}
        </Text>
      ) : null}
      <Text style={styles.subtitle}>
        {widthMm}mm × {heightMm}mm · same layout as the printed gear tag
      </Text>
      <View style={[styles.tagOuter, { width: previewWidth, height: previewHeight }]}>
        <View style={[styles.tagInner, { width: previewWidth, height: previewHeight }]}>
          <View style={[styles.contentArea, contentPadding]}>
            {tagFields.map((field, index) => {
              const label = displayLabelForTagField(field, availableFields);
              const scaledLabelSize = Math.max(10, (field.fontSize || 10) * scale * 0.85);
              return (
                <View key={`${field.field}-${index}`} style={[styles.slotBlock, { maxWidth: contentMaxW }]}>
                  {renderSlot(field, label, scaledLabelSize)}
                </View>
              );
            })}
          </View>

          {qrCodeEnabled ? (
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
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  tagOuter: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
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
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
  },
  slotBlock: {
    marginBottom: 8,
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
