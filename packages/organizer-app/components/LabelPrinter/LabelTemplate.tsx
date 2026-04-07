// Label template for printed tags: shows item details and optional reduced price line.
// Does NOT display seller contact info (phone or email).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Item, Event } from 'shared';
import { formatDropTime } from 'shared';

export interface LabelTemplateProps {
  item: Item;
  event: Event | null | undefined;
}

export default function LabelTemplate({ item, event }: LabelTemplateProps) {
  const showReducedPrice =
    item.enablePriceReduction &&
    item.reducedPrice != null &&
    event?.priceDropTime != null;

  const dropTimeFormatted = event?.priceDropTime
    ? formatDropTime(
        typeof event.priceDropTime === 'string'
          ? event.priceDropTime
          : event.priceDropTime.toISOString()
      )
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.field}>Item #: {item.itemNumber}</Text>
      {item.description ? (
        <Text style={styles.field}>Description: {item.description}</Text>
      ) : null}
      {item.size ? (
        <Text style={styles.field}>Size: {item.size}</Text>
      ) : null}
      <Text style={styles.field}>
        Price: ${item.originalPrice.toFixed(2)}
      </Text>
      {showReducedPrice && (
        <Text style={styles.reducedLine}>
          After {dropTimeFormatted}: ${item.reducedPrice!.toFixed(2)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  field: {
    fontSize: 12,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  reducedLine: {
    fontSize: 12,
    color: '#1A1A1A',
    marginBottom: 2,
    marginTop: 2,
  },
});
