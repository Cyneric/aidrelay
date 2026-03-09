/**
 * @file src/main/secrets/secret-keys.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Utility helpers for namespacing credential keys in keytar.
 * Environment variable secrets use their raw key name for backward
 * compatibility; header secrets are namespaced so they cannot collide with env
 * keys that happen to share the same name.
 */

/** Prefix used for all header secret keys stored in keytar. */
const HEADER_SECRET_PREFIX = '__aidrelay_header__:'

/**
 * Builds the keytar account key used for a secret header value.
 *
 * @param headerName - HTTP header name (e.g., `Authorization`).
 * @returns Namespaced keytar key.
 */
export const toSecretHeaderAccountKey = (headerName: string): string =>
  `${HEADER_SECRET_PREFIX}${headerName}`
