/**
 * Shared layout limits for RN apps (web + native).
 * Keeps primary CTAs and form fields from stretching edge-to-edge on large viewports.
 */
export const FORM_CONTROL_MAX_WIDTH = 400;

/**
 * Staff-facing station flows (check-in, POS, pickup): tuned for phones and tablets.
 * Prefer full-width controls with comfortable padding; optionally cap width on wide tablets/desktop browsers.
 */
export const STAFF_MOBILE_EDGE_PADDING = 16;

/** Extra top padding inside screen headers below the root layout / home affordance */
export const STAFF_MOBILE_HEADER_PADDING_TOP = 12;

/** Min height for primary pressables and text fields (touch-friendly) */
export const STAFF_MOBILE_MIN_TOUCH_HEIGHT = 48;

/**
 * Loose upper bound so controls use full phone/tablet width but do not absurdly stretch on ultra-wide monitors.
 */
export const STAFF_FLOW_CONTENT_MAX_WIDTH = 720;
