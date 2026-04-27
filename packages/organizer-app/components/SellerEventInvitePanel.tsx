import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { buildSellerEventDeepLink, buildSellerEventWebInviteUrl } from 'shared';
import { theme } from '../lib/theme';

const SELLER_WEB_INVITE_ORIGIN =
  typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN
    ? process.env.EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN.trim()
    : '';

type Props = {
  eventId: string;
  eventName?: string;
};

export function SellerEventInvitePanel({ eventId, eventName }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [copiedNative, setCopiedNative] = useState(false);

  const nativeRegistrationUrl = buildSellerEventDeepLink(eventId, 'register');
  const nativeEventPageUrl = buildSellerEventDeepLink(eventId, 'event');

  const webRegistrationUrl = SELLER_WEB_INVITE_ORIGIN
    ? buildSellerEventWebInviteUrl(SELLER_WEB_INVITE_ORIGIN, eventId, 'register')
    : '';
  const webEventPageUrl = SELLER_WEB_INVITE_ORIGIN
    ? buildSellerEventWebInviteUrl(SELLER_WEB_INVITE_ORIGIN, eventId, 'event')
    : '';

  const qrRegistrationValue = webRegistrationUrl || nativeRegistrationUrl;

  const shareRegistration = async () => {
    const title = eventName?.trim() ? `Register for ${eventName.trim()}` : 'Register for our swap';
    const primary = webRegistrationUrl || nativeRegistrationUrl;
    const secondary = webRegistrationUrl ? `\n\nNative app link:\n${nativeRegistrationUrl}` : '';
    try {
      await Share.share({
        title,
        message: `${title}\n\n${primary}${secondary}`,
        url: Platform.OS === 'ios' ? primary : undefined,
      });
    } catch {
      // user dismissed sheet
    }
  };

  const copyRegistration = async () => {
    await Clipboard.setStringAsync(qrRegistrationValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyNativeRegistration = async () => {
    await Clipboard.setStringAsync(nativeRegistrationUrl);
    setCopiedNative(true);
    setTimeout(() => setCopiedNative(false), 2000);
  };

  const copyWebRegistration = async () => {
    if (!webRegistrationUrl) return;
    await Clipboard.setStringAsync(webRegistrationUrl);
    setCopiedWeb(true);
    setTimeout(() => setCopiedWeb(false), 2000);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.lead}>
        {webRegistrationUrl
          ? 'QR and primary “Copy / Share” target your local seller Expo web URL. Native app links are shown below for device testing.'
          : 'Share this link or QR code so sellers can open the swap in the Gear Swap seller app and complete registration.'}
      </Text>
      <View style={styles.qrWrap}>
        <QRCode value={qrRegistrationValue} size={176} backgroundColor={theme.surface} color={theme.text} />
      </View>
      <Text style={styles.label}>
        {webRegistrationUrl ? 'Registration URL (QR uses this)' : 'Registration link (QR uses this)'}
      </Text>
      <Text selectable style={styles.url}>
        {qrRegistrationValue}
      </Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={copyRegistration}>
          <Text style={styles.secondaryBtnText}>{copied ? 'Copied' : 'Copy link'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={shareRegistration}>
          <Text style={styles.primaryBtnText}>Share…</Text>
        </TouchableOpacity>
      </View>
      {webRegistrationUrl ? (
        <TouchableOpacity style={styles.openWebBtn} onPress={() => Linking.openURL(webRegistrationUrl)}>
          <Text style={styles.openWebBtnText}>Open registration in browser</Text>
        </TouchableOpacity>
      ) : null}

      {webRegistrationUrl ? (
        <View style={styles.devDivider}>
          <Text style={styles.devHeading}>Native app (phones with seller app installed)</Text>
          <Text selectable style={styles.urlSmall}>
            {nativeRegistrationUrl}
          </Text>
          <TouchableOpacity style={styles.inlineCopy} onPress={copyNativeRegistration}>
            <Text style={styles.inlineCopyText}>
              {copiedNative ? 'Copied native link' : 'Copy native registration link'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.label}>Event page (native)</Text>
          <Text selectable style={styles.urlSmall}>
            {nativeEventPageUrl}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Event page link (browse details)</Text>
          <Text selectable style={styles.urlSmall}>
            {nativeEventPageUrl}
          </Text>
        </>
      )}

      {webRegistrationUrl ? (
        <View style={styles.devDivider}>
          <Text style={styles.label}>Event page (browser)</Text>
          <Text selectable style={styles.urlSmall}>
            {webEventPageUrl}
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={copyWebRegistration}>
              <Text style={styles.secondaryBtnText}>{copiedWeb ? 'Copied' : 'Copy event URL'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openURL(webEventPageUrl)}>
              <Text style={styles.primaryBtnText}>Open</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : __DEV__ ? (
        <Text style={styles.devHint}>
          Local simulation: add EXPO_PUBLIC_SELLER_WEB_INVITE_ORIGIN=http://localhost:8082 to packages/organizer-app/.env
          (seller app from yarn dev:both), restart organizer, then use the browser URLs here.
        </Text>
      ) : null}
    </View>
  );
}

type ModalProps = Props & {
  visible: boolean;
  onDismiss: () => void;
};

export function SellerEventInviteModal({ visible, eventId, eventName, onDismiss }: ModalProps) {
  if (!eventId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={modalStyles.overlay}>
        <Pressable style={modalStyles.card} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.title}>Event created</Text>
            <Text style={modalStyles.subtitle}>
              {eventName?.trim() ? `“${eventName.trim()}”` : 'Your event'} is ready. Share the seller invite below.
            </Text>
            <SellerEventInvitePanel eventId={eventId} eventName={eventName} />
            <TouchableOpacity
              style={modalStyles.done}
              onPress={() => {
                onDismiss();
              }}
            >
              <Text style={modalStyles.doneText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
  },
  lead: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  qrWrap: {
    alignSelf: 'center',
    padding: 12,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginTop: 4,
  },
  url: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  urlSmall: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: theme.button,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: theme.buttonText,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  secondaryBtnText: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 16,
  },
  openWebBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  openWebBtnText: {
    color: theme.link,
    fontSize: 16,
    fontWeight: '600',
  },
  devDivider: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 8,
  },
  devHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  inlineCopy: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  inlineCopyText: {
    color: theme.link,
    fontSize: 14,
    fontWeight: '600',
  },
  devHint: {
    marginTop: 14,
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 18,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  done: {
    marginTop: 20,
    backgroundColor: theme.button,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneText: {
    color: theme.buttonText,
    fontWeight: '600',
    fontSize: 16,
  },
});
