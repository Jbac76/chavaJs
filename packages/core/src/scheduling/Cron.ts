/**
 * A compact cron matcher for 5-field expressions (Laravel-style):
 *   minute hour day-of-month month day-of-week
 *
 * Supports the standard token forms: wildcard, step, range, list, and
 * range-with-step. Matches a Date in the server's local timezone
 * (Laravel's default behavior).
 */
export function cronMatches(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `Invalid cron expression [${expression}] - expected 5 fields (minute hour dom month dow).`,
    );
  }
  const [minute, hour, dom, month, dow] = fields;
  const matches =
    fieldMatches(minute, date.getMinutes()) &&
    fieldMatches(hour, date.getHours()) &&
    fieldMatches(dom, date.getDate()) &&
    fieldMatches(month, date.getMonth() + 1) &&
    dowFieldMatches(dow, date.getDay());
  return matches;
}

/** Convert a 5-field cron expression to a human-readable description. */
export function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;
  const [minute, hour, dom, month, dow] = parts;
  const descriptions: string[] = [];
  if (minute === '*/1' || minute === '*') descriptions.push('every minute');
  else if (minute.startsWith('*/')) descriptions.push(`every ${minute.slice(2)} minutes`);
  else descriptions.push(`at minute ${minute}`);
  if (hour === '*') descriptions.push('of every hour');
  else descriptions.push(`past ${hour}:${minute === '*' ? '00' : minute}`);
  if (dom !== '*') descriptions.push(`on day ${dom} of the month`);
  if (month !== '*') descriptions.push(`in month ${month}`);
  if (dow !== '*') descriptions.push(`on weekday ${dow}`);
  return descriptions.join(', ');
}

function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  return field.split(',').some((part) => partMatches(part, value));
}

function dowFieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  // Cron dow: 0-6 (Sunday=0). Support 7 as alias for 0 (Laravel/Node cron).
  const normalized = value === 0 ? 7 : value;
  return field.split(',').some((part) => {
    // Steps (e.g. */2) must be checked against both spellings of Sunday so
    // the 0→7 normalization can't flip the modulo result.
    if (/^\*\/\d+$/.test(part)) return partMatches(part, normalized) || partMatches(part, value);
    const normalizedPart = part === '0' ? '7' : part;
    return partMatches(normalizedPart, normalized);
  });
}

function partMatches(part: string, value: number): boolean {
  if (part === '*') return true;
  // Bare-asterisk step: */5 → every 5 units from zero.
  const starStep = /^\*\/(\d+)$/.exec(part);
  if (starStep) return value % Number(starStep[1]) === 0;
  const stepMatch = /^(\d+)(?:-(\d+))?\/(\d+)$/.exec(part);
  if (stepMatch) {
    const start = stepMatch[2] ? Number(stepMatch[1]) : 0;
    const end = stepMatch[2] ? Number(stepMatch[2]) : 59;
    const step = Number(stepMatch[3]);
    return value >= start && value <= end && (value - start) % step === 0;
  }
  const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    return value >= start && value <= end;
  }
  if (/^\d+$/.test(part)) return Number(part) === value;
  return false;
}
