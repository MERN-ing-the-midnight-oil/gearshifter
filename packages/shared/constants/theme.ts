export type StationThemeToken = {
  backgroundTint: string;
  headerTint: string;
  headerAccent: string;
  actionAccent: string;
};

export const STATION_THEME = {
  checkIn: {
    backgroundTint: '#F4F8FF',
    headerTint: '#FBFDFF',
    headerAccent: '#2563EB',
    actionAccent: '#2563EB',
  },
  pos: {
    backgroundTint: '#F3FBF6',
    headerTint: '#FAFFFC',
    headerAccent: '#16A34A',
    actionAccent: '#16A34A',
  },
  pickup: {
    backgroundTint: '#FFF9F0',
    headerTint: '#FFFCF6',
    headerAccent: '#D97706',
    actionAccent: '#D97706',
  },
  reports: {
    backgroundTint: '#F7F8FA',
    headerTint: '#FBFCFD',
    headerAccent: '#475569',
    actionAccent: '#475569',
  },
} as const satisfies Record<string, StationThemeToken>;
