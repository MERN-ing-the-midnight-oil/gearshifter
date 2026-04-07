"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardShadow = exports.theme = void 0;
const react_native_1 = require("react-native");
/**
 * Theme colors for the Organizer App
 * Based on blue (#2E8BC0) and yellow (#F4C552) color palette
 */
exports.theme = {
    // Primary brand colors
    primary: '#2E8BC0', // Ocean Blue
    secondary: '#F4C552', // Mustard Yellow
    offWhite: '#FDF5E6', // Warm cream
    // UI colors
    background: '#FDF5E6', // Off-white background
    surface: '#FFFFFF', // White for cards/surfaces
    text: '#1A1A1A', // Dark text
    textSecondary: '#666666', // Gray text
    border: '#E5E5E5', // Light border
    // Status colors (keeping semantic meanings but adjusting to theme)
    status: {
        registration: '#2E8BC0', // Blue (primary)
        checkin: '#F4C552', // Yellow (secondary)
        shopping: '#50C878', // Green (kept for shopping)
        pickup: '#9B59B6', // Purple (kept for pickup)
        closed: '#6C757D', // Gray (kept for closed)
    },
    // Interactive elements
    link: '#2E8BC0', // Primary blue for links
    button: '#2E8BC0', // Primary blue for buttons
    buttonText: '#FFFFFF', // White text on buttons
    activityIndicator: '#2E8BC0', // Primary blue for loading indicators
    // Error and warning
    error: '#DC3545', // Red for errors
    warning: '#F4C552', // Yellow for warnings
    // Shadows
    shadowColor: '#000000',
    // Dark elements
    darkCharcoal: '#333333', // For sprocket/gear elements
    pureWhite: '#FFFFFF', // For highlights/shine
};
/** Platform-aware card shadow (avoids deprecated shadow* on web) */
exports.cardShadow = react_native_1.Platform.select({
    web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
    },
    default: {
        shadowColor: exports.theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
});
