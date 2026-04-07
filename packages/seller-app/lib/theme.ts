/**
 * Theme colors for the Seller App
 * Based on green (#2D5A43) and orange (#E08E45) color palette
 */

export const theme = {
  // Primary brand colors
  primary: '#2D5A43', // Forest Green
  secondary: '#E08E45', // Burnt Orange
  offWhite: '#F5F1E1', // Cream
  
  // UI colors
  background: '#F5F1E1', // Off-white background
  surface: '#FFFFFF', // White for cards/surfaces
  text: '#1A1A1A', // Dark text
  textSecondary: '#666666', // Gray text
  border: '#E5E5E5', // Light border
  
  // Status colors (keeping semantic meanings but adjusting to theme)
  status: {
    registration: '#2D5A43', // Green (primary)
    checkin: '#E08E45', // Orange (secondary)
    shopping: '#50C878', // Green (kept for shopping)
    pickup: '#9B59B6', // Purple (kept for pickup)
    closed: '#6C757D', // Gray (kept for closed)
  },
  
  // Interactive elements
  link: '#2D5A43', // Primary green for links
  button: '#2D5A43', // Primary green for buttons
  buttonText: '#FFFFFF', // White text on buttons
  activityIndicator: '#2D5A43', // Primary green for loading indicators
  
  // Error and warning
  error: '#DC3545', // Red for errors
  warning: '#E08E45', // Orange for warnings
  
  // Shadows
  shadowColor: '#000000',
  
  // Dark elements
  darkCharcoal: '#333333', // For sprocket/gear elements
  pureWhite: '#FFFFFF', // For highlights/shine
} as const;

export type Theme = typeof theme;


