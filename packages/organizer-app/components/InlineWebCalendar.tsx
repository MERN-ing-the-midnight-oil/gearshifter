import { View } from 'react-native';

export type InlineWebCalendarProps = {
  selected: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  showTimeSelect: boolean;
};

/** Native: calendar is unused (organizer web-only flows use `.web.tsx`). */
export function InlineWebCalendar(_props: InlineWebCalendarProps) {
  return <View />;
}
