// Real-time tag preview with flow layout and word wrap
// Shows tag fields in order with correct aspect ratio for selected label size

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  TextInput,
  ScrollView,
  useWindowDimensions,
  Image,
} from 'react-native';
import type { TagField, QRCodePosition, TagPrintOrientation } from 'shared';

const QR_NUDGE_MM = 0.5;

const MM_TO_PX = 3.779527559; // 1mm ≈ 3.78px at 96 DPI
const MAX_PREVIEW_WIDTH = 280;
/** Smaller preview cap when shown inside template list tiles (more tags above the fold). */
const EMBEDDED_LIST_MAX_PREVIEW_WIDTH = 200;

/** Matches numbered chips on the tag and rows in the side key. */
const KEY_COLORS = ['#6366F1', '#0EA5E9', '#14B8A6', '#EAB308', '#F97316', '#EC4899', '#8B5CF6'];

function TagLineDecorationImage({ uri, sizePx }: { uri: string; sizePx: number }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri }}
      accessibilityIgnoresInvertColors
      style={{ width: sizePx, height: sizePx, marginRight: 4, flexShrink: 0 }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

/** Sample value shown on the mockup — mirrors printer money/percent formatting so controls feel immediate. */
function previewSampleForField(field: TagField, maxLength: number): string {
  const fmt = field.format || '';
  if (fmt.includes('$')) {
    return '$99.00';
  }
  if (fmt.includes('%')) {
    return '25%';
  }
  switch (field.field) {
    case 'sale_summary':
      return 'Sold to Taylor Smith at May 8, 2026, 3:45 PM for $125.00';
    case 'buyer_name':
      return 'Taylor Smith';
    case 'buyer_phone':
      return '(555) 123-4567';
    case 'buyer_email':
      return 'buyer@example.com';
    case 'sale_datetime':
    case 'printed_datetime':
      return 'May 8, 2026, 3:45 PM';
    case 'item_number':
      return 'B-1042';
    case 'item_description':
      return 'Sample item description';
    case 'sold_price':
      return '$125.00';
    case 'seller_amount':
      return '$93.75';
    case 'commission_amount':
      return '$31.25';
    case 'event_name':
      return 'Spring Gear Swap';
    case 'seller_name':
      return 'Alex Seller';
    default:
      break;
  }
  const n = Math.max(1, Math.min(maxLength, 48));
  return 'X'.repeat(n);
}

interface TagPreviewMockupProps {
  widthMm: number;
  heightMm: number;
  tagFields: TagField[];
  qrCodePosition: QRCodePosition;
  qrCodeSize: number;
  /** Nudge from anchor: +X right, +Y down (mm). */
  qrCodeOffsetXMm?: number;
  qrCodeOffsetYMm?: number;
  /** Shown in subtitle; stored on template for printing. */
  tagOrientation?: TagPrintOrientation;
  availableFields: Array<{ name: string; label: string; defaultLabel?: string }>;
  /** Per-field and QR controls for the configure-tag screen. */
  interactive?: boolean;
  /** Patch any `TagField` props (label, fontSize, fontWeight, hideLabelOnTag, maxLength, format, …). */
  onUpdateTagField?: (fieldIndex: number, updates: Partial<TagField>) => void;
  onMoveField?: (fieldIndex: number, direction: 'up' | 'down') => void;
  onQrSizeDelta?: (deltaMm: number) => void;
  onQrOffsetDelta?: (deltaXMm: number, deltaYMm: number) => void;
  /**
   * Compact preview for template list tiles: smaller mockup, no “Tag Preview” header,
   * minimal padding so more rows fit on screen.
   */
  embeddedInList?: boolean;
}

export default function TagPreviewMockup({
  widthMm,
  heightMm,
  tagFields,
  qrCodePosition,
  qrCodeSize,
  qrCodeOffsetXMm = 0,
  qrCodeOffsetYMm = 0,
  tagOrientation,
  availableFields,
  interactive = false,
  onUpdateTagField,
  onMoveField,
  onQrSizeDelta,
  onQrOffsetDelta,
  embeddedInList = false,
}: TagPreviewMockupProps) {
  const { width: windowWidth } = useWindowDimensions();
  const aspectRatio = heightMm / widthMm;
  const maxPreviewCap = embeddedInList ? EMBEDDED_LIST_MAX_PREVIEW_WIDTH : MAX_PREVIEW_WIDTH;
  const previewWidth = Math.min(maxPreviewCap, embeddedInList ? maxPreviewCap : windowWidth - 48);
  const previewHeight = previewWidth * aspectRatio;

  const getFieldDisplayInfo = (field: TagField) => {
    const fieldInfo = availableFields.find((f) => f.name === field.field);
    return {
      label: field.label || fieldInfo?.defaultLabel || fieldInfo?.label || field.field,
      hideLabelOnTag: Boolean(field.hideLabelOnTag),
      fontSize: field.fontSize || 10,
      maxLength: field.maxLength ?? 30,
    };
  };

  // Scale factor from mm to preview pixels
  const scale = previewWidth / (widthMm * MM_TO_PX);
  const qrSizePx = Math.min(qrCodeSize * MM_TO_PX * scale, previewWidth * 0.35);
  const paddingPx = embeddedInList ? 4 : 6;
  const fieldLineNumberOfLines = embeddedInList ? 2 : 3;

  const isQrLeft = qrCodePosition === 'top-left' || qrCodePosition === 'bottom-left';
  const isQrRight = qrCodePosition === 'top-right' || qrCodePosition === 'bottom-right';
  const isQrTop = qrCodePosition === 'top-left' || qrCodePosition === 'top-right';
  const isQrBottom = qrCodePosition === 'bottom-left' || qrCodePosition === 'bottom-right';
  const isCenterQR = qrCodePosition === 'center';

  const oxPx = qrCodeOffsetXMm * MM_TO_PX * scale;
  const oyPx = qrCodeOffsetYMm * MM_TO_PX * scale;

  let qrLeft: number;
  let qrTop: number;
  if (isCenterQR) {
    qrLeft = (previewWidth - qrSizePx) / 2 + oxPx;
    qrTop = (previewHeight - qrSizePx) / 2 + oyPx;
  } else if (isQrTop && isQrLeft) {
    qrLeft = paddingPx + oxPx;
    qrTop = paddingPx + oyPx;
  } else if (isQrTop && isQrRight) {
    qrLeft = previewWidth - paddingPx - qrSizePx + oxPx;
    qrTop = paddingPx + oyPx;
  } else if (isQrBottom && isQrLeft) {
    qrLeft = paddingPx + oxPx;
    qrTop = previewHeight - paddingPx - qrSizePx + oyPx;
  } else {
    qrLeft = previewWidth - paddingPx - qrSizePx + oxPx;
    qrTop = previewHeight - paddingPx - qrSizePx + oyPx;
  }
  qrLeft = Math.max(0, Math.min(previewWidth - qrSizePx, qrLeft));
  qrTop = Math.max(0, Math.min(previewHeight - qrSizePx, qrTop));

  const contentPadding = {
    padding: paddingPx,
    paddingLeft: isQrLeft ? qrSizePx + paddingPx : paddingPx,
    paddingRight: isQrRight ? qrSizePx + paddingPx : paddingPx,
    paddingTop: isQrTop ? qrSizePx + paddingPx : paddingPx,
    paddingBottom: isQrBottom ? qrSizePx + paddingPx : paddingPx,
  };
  const contentMaxWidth = previewWidth - contentPadding.paddingLeft - contentPadding.paddingRight;

  const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {};

  const tagMockup = (
    <View
      style={[
        styles.tagOuter,
        embeddedInList && styles.tagOuterEmbeddedList,
        {
          width: previewWidth,
          height: previewHeight,
        },
      ]}
    >
      <View style={[styles.tagInner, { width: previewWidth, height: previewHeight }]}>
        <View style={[styles.contentArea, contentPadding]}>
          {tagFields.map((field, index) => {
            const { label, hideLabelOnTag, fontSize, maxLength } = getFieldDisplayInfo(field);
            const scaledFontSize = Math.max(8, fontSize * scale * 0.9);
            const sampleValue = previewSampleForField(field, maxLength);
            const displayText = hideLabelOnTag ? sampleValue : `${label}: ${sampleValue}`;
            const keyColor = KEY_COLORS[index % KEY_COLORS.length];
            const emoji = (field.tagLineEmoji ?? '').trim();
            const imgUrl = (field.tagLineImageUrl ?? '').trim();
            const decoSize = Math.round(Math.min(28, Math.max(14, scaledFontSize * 1.25)));

            return (
              <View key={`${field.field}-${index}`} style={styles.fieldLineRow}>
                {interactive ? (
                  <View style={[styles.keyIndexBadge, { backgroundColor: keyColor }]}>
                    <Text style={styles.keyIndexText}>{index + 1}</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.fieldLineMain,
                    { maxWidth: interactive ? contentMaxWidth - 28 : contentMaxWidth },
                  ]}
                >
                  <View style={styles.fieldLineDecorRow}>
                    {imgUrl.startsWith('https://') ? (
                      <TagLineDecorationImage uri={imgUrl} sizePx={decoSize} />
                    ) : null}
                    {emoji ? (
                      <Text style={[styles.fieldEmojiInline, { fontSize: scaledFontSize }]}>{emoji}</Text>
                    ) : null}
                    <Text
                      style={[
                        styles.fieldText,
                        {
                          flex: 1,
                          minWidth: 0,
                          fontSize: scaledFontSize,
                          fontWeight: field.fontWeight === 'bold' ? 'bold' : 'normal',
                        },
                      ]}
                      numberOfLines={fieldLineNumberOfLines}
                    >
                      {displayText}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.qrCode,
            {
              width: qrSizePx,
              height: qrSizePx,
              position: 'absolute',
              left: qrLeft,
              top: qrTop,
            },
          ]}
        >
          <Text style={styles.qrText}>QR</Text>
        </View>
      </View>
    </View>
  );

  if (embeddedInList) {
    return (
      <View style={styles.containerEmbeddedList}>
        {tagMockup}
        <Text style={styles.embeddedListCaption} numberOfLines={1}>
          {widthMm}×{heightMm} mm
          {tagOrientation
            ? tagOrientation === 'landscape'
              ? ' · landscape'
              : ' · portrait'
            : ''}
        </Text>
      </View>
    );
  }

  const patchField = (index: number, updates: Partial<TagField>) => {
    onUpdateTagField?.(index, updates);
  };

  const bumpFontSize = (index: number, delta: number) => {
    const tf = tagFields[index];
    if (!tf) return;
    const current = Number(tf.fontSize ?? 10);
    const next = Math.min(40, Math.max(6, Math.round((current + delta) * 10) / 10));
    patchField(index, { fontSize: next });
  };

  const sideControlBox = !interactive ? null : (
    <View style={styles.sideControlBox}>
      <Text style={styles.sideControlTitle}>Tag field key</Text>
      <Text style={styles.sideLegend}>
        Numbers match the tag. Use the controls to change how each line looks when printed (label, size, weight, truncation,
        and number style where applicable).
      </Text>
      <ScrollView
        style={styles.sidePanelScroll}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {tagFields.map((field, index) => {
          const { label } = getFieldDisplayInfo(field);
          const keyColor = KEY_COLORS[index % KEY_COLORS.length];
          const ml = field.maxLength ?? 30;
          const isBold = field.fontWeight === 'bold';
          const fmt = field.format || '';
          const hasDollar = fmt.includes('$');
          const hasPct = fmt.includes('%');

          return (
            <View
              key={`ctl-${field.field}-${index}`}
              style={[styles.sideFieldBlock, { borderLeftColor: keyColor }]}
            >
              <View style={styles.sideFieldHeaderRow}>
                <View style={[styles.keyIndexBadgeSm, { backgroundColor: keyColor }]}>
                  <Text style={styles.keyIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.sideFieldKeyMono} numberOfLines={1}>
                  {field.field}
                </Text>
              </View>
              <Text style={styles.sideMiniLabel}>Label on forms and tag</Text>
              <TextInput
                style={styles.labelInput}
                value={field.label ?? ''}
                onChangeText={(text) => patchField(index, { label: text })}
                placeholder={label}
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.sideMiniLabel}>Order · size · weight</Text>
              <View style={styles.sideBtnRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillReorder,
                    index === 0 && styles.pillDisabled,
                    pressed && index > 0 && styles.pillPressed,
                  ]}
                  disabled={index === 0}
                  onPress={() => onMoveField?.(index, 'up')}
                  accessibilityLabel={`Move ${label} up`}
                  {...webPointer}
                >
                  <Text style={styles.pillBtnText}>↑</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillReorder,
                    index >= tagFields.length - 1 && styles.pillDisabled,
                    pressed && index < tagFields.length - 1 && styles.pillPressed,
                  ]}
                  disabled={index >= tagFields.length - 1}
                  onPress={() => onMoveField?.(index, 'down')}
                  accessibilityLabel={`Move ${label} down`}
                  {...webPointer}
                >
                  <Text style={styles.pillBtnText}>↓</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.pillBtn, styles.pillFontSm, pressed && styles.pillPressed]}
                  onPress={() => bumpFontSize(index, -1)}
                  accessibilityLabel={`Smaller text: ${label}`}
                  {...webPointer}
                >
                  <Text style={styles.fontSmLabel}>A</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.pillBtn, styles.pillFontLg, pressed && styles.pillPressed]}
                  onPress={() => bumpFontSize(index, 1)}
                  accessibilityLabel={`Larger text: ${label}`}
                  {...webPointer}
                >
                  <Text style={styles.fontLgLabel}>A</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillBold,
                    isBold && styles.pillBoldOn,
                    pressed && styles.pillPressed,
                  ]}
                  onPress={() => patchField(index, { fontWeight: isBold ? 'normal' : 'bold' })}
                  accessibilityLabel={isBold ? 'Normal weight' : 'Bold'}
                  {...webPointer}
                >
                  <Text style={[styles.pillBoldText, isBold && styles.pillBoldTextOn]}>B</Text>
                </Pressable>
              </View>
              <Text style={styles.sideMiniLabel}>What prints before the value</Text>
              <View style={styles.sideBtnRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtnWide,
                    !field.hideLabelOnTag ? styles.pillChoiceOn : styles.pillChoiceOff,
                    pressed && styles.pillPressed,
                  ]}
                  onPress={() => patchField(index, { hideLabelOnTag: false })}
                  {...webPointer}
                >
                  <Text
                    style={
                      !field.hideLabelOnTag ? styles.pillChoiceTextOn : styles.pillChoiceTextOff
                    }
                  >
                    Label + value
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtnWide,
                    field.hideLabelOnTag ? styles.pillChoiceOn : styles.pillChoiceOff,
                    pressed && styles.pillPressed,
                  ]}
                  onPress={() => patchField(index, { hideLabelOnTag: true })}
                  {...webPointer}
                >
                  <Text
                    style={field.hideLabelOnTag ? styles.pillChoiceTextOn : styles.pillChoiceTextOff}
                  >
                    Value only
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.sideMiniLabel}>Max characters on tag (truncation)</Text>
              <View style={styles.sideBtnRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillMaxLen,
                    ml <= 5 && styles.pillDisabled,
                    pressed && ml > 5 && styles.pillPressed,
                  ]}
                  disabled={ml <= 5}
                  onPress={() => patchField(index, { maxLength: Math.max(5, ml - 5) })}
                  {...webPointer}
                >
                  <Text style={styles.pillBtnText}>−</Text>
                </Pressable>
                <View style={styles.maxLenReadout}>
                  <Text style={styles.maxLenReadoutText}>{ml}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillMaxLen,
                    ml >= 500 && styles.pillDisabled,
                    pressed && ml < 500 && styles.pillPressed,
                  ]}
                  disabled={ml >= 500}
                  onPress={() => patchField(index, { maxLength: Math.min(500, ml + 5) })}
                  {...webPointer}
                >
                  <Text style={styles.pillBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.sideMiniLabel}>Number / money style (printed value)</Text>
              <View style={styles.sideBtnRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillFormat,
                    hasDollar && styles.pillFormatOn,
                    pressed && styles.pillPressed,
                  ]}
                  onPress={() => patchField(index, { format: '$%.2f' })}
                  {...webPointer}
                >
                  <Text style={[styles.pillFormatText, hasDollar && styles.pillFormatTextOn]}>$</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillFormat,
                    hasPct && styles.pillFormatOn,
                    pressed && styles.pillPressed,
                  ]}
                  onPress={() => patchField(index, { format: '%.0f%%' })}
                  {...webPointer}
                >
                  <Text style={[styles.pillFormatText, hasPct && styles.pillFormatTextOn]}>%</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.pillBtn,
                    styles.pillFormat,
                    !fmt && styles.pillFormatOn,
                    pressed && styles.pillPressed,
                  ]}
                  onPress={() => patchField(index, { format: '' })}
                  {...webPointer}
                >
                  <Text style={[styles.pillFormatText, !fmt && styles.pillFormatTextOn]}>Plain</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <View style={styles.sideQrBlock}>
          <Text style={styles.sideFieldLabel}>QR code ({Math.round(qrCodeSize)} mm)</Text>
          <View style={styles.sideBtnRow}>
            <Pressable
              style={({ pressed }) => [styles.pillBtn, styles.pillQrSm, pressed && styles.pillPressed]}
              onPress={() => onQrSizeDelta?.(-1)}
              accessibilityLabel="Smaller QR"
              {...webPointer}
            >
              <Text style={styles.qrDeltaText}>−</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.pillBtn, styles.pillQrLg, pressed && styles.pillPressed]}
              onPress={() => onQrSizeDelta?.(1)}
              accessibilityLabel="Larger QR"
              {...webPointer}
            >
              <Text style={styles.qrDeltaText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.sideMiniLabel}>Nudge (mm · +right +down)</Text>
          <Text style={styles.qrOffsetReadout}>
            X {qrCodeOffsetXMm.toFixed(1)} · Y {qrCodeOffsetYMm.toFixed(1)}
          </Text>
          <View style={styles.qrNudgeCross}>
            <View style={styles.qrNudgeRow}>
              <Pressable
                style={({ pressed }) => [styles.pillBtn, styles.pillQrNudge, pressed && styles.pillPressed]}
                onPress={() => onQrOffsetDelta?.(-QR_NUDGE_MM, 0)}
                accessibilityLabel="Nudge QR left"
                {...webPointer}
              >
                <Text style={styles.qrNudgeText}>←</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.pillBtn, styles.pillQrNudge, pressed && styles.pillPressed]}
                onPress={() => onQrOffsetDelta?.(QR_NUDGE_MM, 0)}
                accessibilityLabel="Nudge QR right"
                {...webPointer}
              >
                <Text style={styles.qrNudgeText}>→</Text>
              </Pressable>
            </View>
            <View style={styles.qrNudgeRow}>
              <Pressable
                style={({ pressed }) => [styles.pillBtn, styles.pillQrNudge, pressed && styles.pillPressed]}
                onPress={() => onQrOffsetDelta?.(0, -QR_NUDGE_MM)}
                accessibilityLabel="Nudge QR up"
                {...webPointer}
              >
                <Text style={styles.qrNudgeText}>↑</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.pillBtn, styles.pillQrNudge, pressed && styles.pillPressed]}
                onPress={() => onQrOffsetDelta?.(0, QR_NUDGE_MM)}
                accessibilityLabel="Nudge QR down"
                {...webPointer}
              >
                <Text style={styles.qrNudgeText}>↓</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.qrResetNudge, pressed && styles.pillPressed]}
            onPress={() => {
              onQrOffsetDelta?.(-qrCodeOffsetXMm, -qrCodeOffsetYMm);
            }}
            {...webPointer}
          >
            <Text style={styles.qrResetNudgeText}>Reset nudge</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tag Preview</Text>
      <Text style={styles.subtitle}>
        {widthMm}mm × {heightMm}mm
        {tagOrientation
          ? ` · ${tagOrientation === 'landscape' ? 'Landscape' : 'Portrait'}`
          : ''}
      </Text>
      {interactive ? (
        <View style={styles.previewWithSide}>
          <View style={styles.tagPreviewColumn}>{tagMockup}</View>
          {sideControlBox}
        </View>
      ) : (
        tagMockup
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerEmbeddedList: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginVertical: 0,
    alignItems: 'flex-start',
  },
  embeddedListCaption: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    ...(Platform.OS === 'web' && { fontVariantNumeric: 'tabular-nums' as const }),
  },
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
  tagOuterEmbeddedList: {
    borderWidth: 1,
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
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
  previewWithSide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
    ...(Platform.OS === 'web' && { width: '100%' as const }),
  },
  tagPreviewColumn: {
    flexShrink: 0,
  },
  sideControlBox: {
    flexGrow: 0,
    flexShrink: 0,
    width: 300,
    minWidth: 260,
    maxWidth: 320,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  sideControlTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  sideLegend: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 4,
  },
  sidePanelScroll: {
    maxHeight: 480,
  },
  fieldLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 2,
    maxWidth: '100%',
  },
  fieldLineMain: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  fieldLineDecorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 2,
  },
  fieldEmojiInline: {
    marginRight: 4,
    lineHeight: undefined,
  },
  keyIndexBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  keyIndexBadgeSm: {
    minWidth: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyIndexText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  sideFieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sideFieldKeyMono: {
    flex: 1,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'monospace',
    color: '#64748B',
  },
  sideMiniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 4,
  },
  labelInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1E293B',
  },
  sideFieldBlock: {
    gap: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#CBD5E1',
    paddingLeft: 10,
    marginBottom: 12,
  },
  sideQrBlock: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    gap: 6,
  },
  qrOffsetReadout: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    ...(Platform.OS === 'web' && { fontVariantNumeric: 'tabular-nums' as const }),
  },
  qrNudgeCross: {
    gap: 6,
  },
  qrNudgeRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  pillQrNudge: {
    backgroundColor: '#818CF8',
    minWidth: 34,
    minHeight: 28,
  },
  qrNudgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  qrResetNudge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  qrResetNudgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  sideFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  sideBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  fieldText: {
    color: '#1A1A1A',
    marginBottom: 2,
    ...(Platform.OS === 'web' && { wordBreak: 'break-word' as const }),
  },
  pillBtn: {
    minWidth: 26,
    minHeight: 26,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  pillPressed: {
    opacity: 0.82,
  },
  pillDisabled: {
    opacity: 0.35,
  },
  pillReorder: {
    backgroundColor: '#A78BFA',
  },
  pillFontSm: {
    backgroundColor: '#FB923C',
  },
  pillFontLg: {
    backgroundColor: '#2DD4BF',
  },
  pillQrSm: {
    backgroundColor: '#F472B6',
  },
  pillQrLg: {
    backgroundColor: '#4ADE80',
  },
  pillBold: {
    backgroundColor: '#E2E8F0',
  },
  pillBoldOn: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  pillBoldText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '800',
  },
  pillBoldTextOn: {
    color: '#FFFFFF',
  },
  pillBtnWide: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 28,
    justifyContent: 'center',
    flexGrow: 1,
    flexBasis: '42%',
    minWidth: 100,
  },
  pillChoiceOn: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  pillChoiceOff: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  pillChoiceTextOn: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pillChoiceTextOff: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  pillMaxLen: {
    backgroundColor: '#94A3B8',
  },
  maxLenReadout: {
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  maxLenReadoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  pillFormat: {
    backgroundColor: '#E2E8F0',
  },
  pillFormatOn: {
    backgroundColor: '#0D9488',
    borderColor: '#0F766E',
  },
  pillFormatText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  pillFormatTextOn: {
    color: '#FFFFFF',
  },
  pillBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  fontSmLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  fontLgLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  qrDeltaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
