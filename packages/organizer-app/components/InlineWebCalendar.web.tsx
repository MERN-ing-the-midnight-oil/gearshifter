import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { View, StyleSheet } from 'react-native';
import type { InlineWebCalendarProps } from './InlineWebCalendar';

export function InlineWebCalendar({
  selected,
  onChange,
  minDate,
  showTimeSelect,
}: InlineWebCalendarProps) {
  return (
    <View style={styles.wrap} collapsable={false}>
      <DatePicker
        selected={selected}
        onChange={(d: Date | null) => {
          if (d) onChange(d);
        }}
        minDate={minDate}
        inline
        showTimeSelect={showTimeSelect}
        timeIntervals={15}
        dateFormat={showTimeSelect ? 'MMMM d, yyyy h:mm aa' : 'MMMM d, yyyy'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
});
