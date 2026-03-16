/**
 * CLI Output Formatting — handles --json flag and human-readable output
 */

/**
 * Formats a successful result for CLI output.
 * With --json flag: outputs valid parseable JSON.
 * Without: outputs human-readable key-value pairs.
 */
export function formatOutput(data: Record<string, unknown>, json?: boolean): string {
  if (json) {
    return JSON.stringify({ success: true, data }, null, 2);
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join('\n');
}

/**
 * Formats an error for CLI output.
 * With --json flag: outputs valid parseable JSON with error type and message.
 * Without: outputs human-readable error with type and description.
 */
export function formatError(type: string, message: string, json?: boolean): string {
  if (json) {
    return JSON.stringify({ success: false, error: { type, message } }, null, 2);
  }

  return `Error [${type}]: ${message}`;
}
