import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { useMemo } from 'react';
import { useRoute } from '@react-navigation/native';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { theme } from '../lib/theme';

export type OrganizerBreadcrumbItem = {
  label: string;
  /** Navigate via Expo Router when the segment is tappable. */
  href?: Href;
  /** When set (and segment is tappable), runs instead of `href` navigation. */
  onPress?: () => void;
};

type OrganizerBreadcrumbsProps = {
  items: OrganizerBreadcrumbItem[];
};

export function OrganizerBreadcrumbs({ items }: OrganizerBreadcrumbsProps) {
  const router = useRouter();

  if (!items.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      accessibilityLabel={items.map((i) => i.label).join(', ')}
    >
      <View style={styles.row}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const showLink = !isLast && (Boolean(item.href) || Boolean(item.onPress));

          if (showLink && (item.href || item.onPress)) {
            return (
              <View key={`${item.label}-${index}`} style={styles.segment}>
                <Pressable
                  onPress={() => {
                    if (item.onPress) {
                      item.onPress();
                    } else if (item.href) {
                      router.push(item.href as Href);
                    }
                  }}
                  style={({ pressed }) => [styles.linkWrap, pressed && styles.linkPressed]}
                  accessibilityRole="link"
                  accessibilityLabel={`${item.label}, go to`}
                  {...(Platform.OS === 'web'
                    ? ({ cursor: 'pointer', role: 'link' } as Record<string, unknown>)
                    : {})}
                >
                  <Text style={styles.linkText} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
                <Text style={styles.separator}>{' › '}</Text>
              </View>
            );
          }

          return (
            <View key={`${item.label}-${index}`} style={styles.segment}>
              <Text
                style={[styles.currentText, isLast && styles.currentTextLast]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {!isLast ? <Text style={styles.separator}>{' › '}</Text> : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 8,
    minHeight: 44,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    maxWidth: '100%',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  linkWrap: {
    maxWidth: 200,
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as object)),
  },
  linkPressed: {
    opacity: 0.75,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.link,
  },
  separator: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  currentText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
    maxWidth: 220,
  },
  currentTextLast: {
    color: theme.text,
    fontWeight: '700',
  },
});

const DASHBOARD_HOME_HREF: Href = '/(dashboard)';

const DASHBOARD_ROUTE_TITLES: Record<string, string> = {
  index: 'Org Dashboard',
  'create-event': 'Create Event',
  categories: 'Categories',
  'commission-rates': 'Commission Rates',
  'field-definitions': 'Item Fields',
  'gear-tags': 'Item Tags',
  'seller-receipts': 'Seller receipts',
  'sale-settings': 'Sale settings',
  'price-reduction-settings': 'Price Reductions',
  'swap-registration-fields': 'Seller Registration Form',
  'staff-accounts': 'Staff Accounts',
  'post-event-inventory': 'Post-event inventory',
};

function titleForDashboardRoute(routeName: string): string {
  const mapped = DASHBOARD_ROUTE_TITLES[routeName];
  if (mapped) return mapped;
  return routeName
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function dashboardBreadcrumbItemsForRoute(routeName: string): OrganizerBreadcrumbItem[] {
  if (routeName === 'index') {
    return [{ label: 'Org Dashboard' }];
  }
  return [{ label: 'Org Dashboard', href: DASHBOARD_HOME_HREF }, { label: titleForDashboardRoute(routeName) }];
}

/** Stack `headerTitle` for `app/(dashboard)/_layout` screens. */
export function DashboardStackBreadcrumbs() {
  const route = useRoute();
  const items = useMemo(() => dashboardBreadcrumbItemsForRoute(route.name), [route.name]);
  return <OrganizerBreadcrumbs items={items} />;
}

/** Stack `headerTitle` for `app/(event)/_layout` top-level event screens. */
export function EventStackBreadcrumbs() {
  const route = useRoute();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(id) ? id[0] : id;

  const items = useMemo((): OrganizerBreadcrumbItem[] => {
    const home: OrganizerBreadcrumbItem = { label: 'Org Dashboard', href: DASHBOARD_HOME_HREF };

    if (route.name === 'manage') {
      return [home, { label: 'Manage Event' }];
    }

    if (route.name === 'stations') {
      if (eventId) {
        return [
          home,
          {
            label: 'Manage Event',
            href: { pathname: '/(event)/manage', params: { id: eventId } },
          },
          { label: 'Stations' },
        ];
      }
      return [home, { label: 'Manage Event' }, { label: 'Stations' }];
    }

    return [home, { label: titleForDashboardRoute(String(route.name)) }];
  }, [route.name, eventId]);

  return <OrganizerBreadcrumbs items={items} />;
}
