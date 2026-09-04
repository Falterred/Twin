// ─────────────────────────────────────────────────────────────
// Shared utility functions for the Twin UI
// ─────────────────────────────────────────────────────────────

import { ACTIONS } from './engine/constants';

/**
 * Format a number as Indian Rupee currency (₹1,50,000).
 * Uses the en-IN locale for proper lakhs/crore grouping.
 */
export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return '₹—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number compactly (e.g., ₹1.5L, ₹60K).
 * For slider display badges.
 */
export function formatINRCompact(value: number): string {
  if (!Number.isFinite(value)) return '₹—';
  if (Math.abs(value) >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(1)}L`;
  }
  if (Math.abs(value) >= 1_000) {
    return `₹${(value / 1_000).toFixed(0)}K`;
  }
  return `₹${value.toFixed(0)}`;
}

/**
 * Quick lookup from action ID to its hex color string.
 */
export const ACTION_COLOR_MAP: Record<string, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.id, a.color]),
);

/**
 * Quick lookup from action ID to its display label.
 */
export const ACTION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.id, a.label]),
);

/**
 * Capitalize first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
