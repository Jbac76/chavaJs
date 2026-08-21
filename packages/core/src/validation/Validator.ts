import { isIP } from 'node:net';
import { currentApp } from '../foundation/registry';
import type { DatabaseManager } from '../database/DatabaseManager';
import { ValidationException } from '../support/exceptions';

export type Rule = { name: string; params: string[] };

export interface CustomRule {
  (
    value: unknown,
    params: string[],
    data: Record<string, unknown>,
    attribute: string,
  ): boolean | string | Promise<boolean | string>;
}

type CustomRuleRegistry = Map<string, CustomRule>;

const customRules: CustomRuleRegistry = new Map();

/**
 * Laravel's Validator, ported. Rule strings compile to individual checks:
 *
 *   Validator.make(data, { email: 'required|email|max:255' })
 *   Validator.make(data, { password: 'required|min:8|confirmed' })
 *   Validator.make(data, { email: 'unique:users,email' })
 *
 * DB-backed rules (`exists`, `unique`) resolve the connection lazily, so the
 * validator also works standalone. `validate()` returns the validated data or
 * throws ValidationException with Laravel-style `{ field: [message] }` errors.
 */
export class ValidatorInstance {
  private readonly errorBag: Record<string, string[]> = {};
  private readonly _validatedData: Record<string, unknown> = {};

  public constructor(
    private readonly data: Record<string, unknown>,
    private readonly rules: Record<string, string>,
    private readonly messages: Record<string, string> = {},
    private readonly attributes: Record<string, string> = {},
  ) {}

  /** Run all rules. Returns true when every field is valid. */
  public async passes(): Promise<boolean> {
    for (const [field, ruleString] of Object.entries(this.rules)) {
      await this.validateField(field, ruleString);
    }
    return Object.keys(this.errorBag).length === 0;
  }

  public async fails(): Promise<boolean> {
    return !(await this.passes());
  }

  /** Laravel-style error bag: `{ field: ['message', ...] }`. */
  public errors(): Record<string, string[]> {
    return { ...this.errorBag };
  }

  /** First error per field (handy for JSON/Inertia forms). */
  public errorsFirst(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [field, errors] of Object.entries(this.errorBag)) {
      out[field] = errors[0] ?? '';
    }
    return out;
  }

  /** The validated data (fields with rules that passed). */
  public validated(): Record<string, unknown> {
    return { ...this._validatedData };
  }

  /** Validate and return the validated data, throwing on failure. */
  public async validate(): Promise<Record<string, unknown>> {
    if (await this.fails()) throw new ValidationException(this.errors());
    return this._validatedData;
  }

  /** Add rules conditionally (Laravel: $v->sometimes('email', 'required', fn)). */
  public sometimes(
    field: string,
    ruleString: string,
    condition: (data: Record<string, unknown>) => boolean,
  ): this {
    if (condition(this.data)) {
      this.rules[field] = [this.rules[field], ruleString].filter(Boolean).join('|');
    }
    return this;
  }

  // ------------------------------------------------------------------ fields

  private async validateField(field: string, ruleString: string): Promise<void> {
    const rules = parseRules(ruleString);
    const value = this.data[field];
    const isEmpty = isEmptyValue(value);
    const requiredRule = rules.find((rule) => rule.name === 'required' || rule.name.startsWith('required_'));
    const hasNullable = rules.some((rule) => rule.name === 'nullable');

    if (requiredRule) {
      const requiredIfActive =
        requiredRule.name === 'required_if'
          ? String(this.data[requiredRule.params[0] ?? ''] ?? '') === (requiredRule.params[1] ?? '')
          : true;
      // Laravel short-circuits: a failing `required` rule fails the field.
      if (requiredIfActive && isEmpty) {
        this.addError(field, this.message(field, requiredRule));
        return;
      }
    } else if (isEmpty && !hasNullable) {
      // Absent or empty non-required fields pass (Laravel behaviour).
      return;
    }

    for (const rule of rules) {
      if (rule.name === 'required' || rule.name.startsWith('required_') || rule.name === 'nullable') continue;
      const ok = await this.checkRule(field, rule, value);
      if (!ok && !this.errorBag[field]) {
        this.addError(field, this.message(field, rule));
      }
    }

    // Only valid fields end up in validated().
    if (!this.errorBag[field]) this.recordValidated(field, value);
  }

  private async checkRule(field: string, rule: Rule, value: unknown): Promise<boolean> {
    const [name, params] = [rule.name, rule.params];

    switch (name) {
      case 'string':
        return typeof value === 'string';
      case 'numeric':
        return value !== null && value !== '' && !Number.isNaN(Number(value));
      case 'integer':
        return /^-?[0-9]+$/.test(String(value ?? ''));
      case 'boolean':
        return [true, false, 1, 0, '1', '0', 'true', 'false'].includes(value as never);
      case 'array':
        return Array.isArray(value);
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        return typeof value === 'string' && /^https?:\/\/.+/i.test(value);
      case 'date':
        return value !== null && value !== '' && !Number.isNaN(Date.parse(String(value)));
      case 'alpha':
        return typeof value === 'string' && /^[A-Za-z]+$/.test(value);
      case 'alpha_num':
        return typeof value === 'string' && /^[A-Za-z0-9]+$/.test(value);
      case 'alpha_dash':
        return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
      case 'confirmed': {
        const other = this.data[`${field}_confirmation`];
        return String(value ?? '') === String(other ?? '');
      }
      case 'same':
        return String(value ?? '') === String(this.data[params[0] ?? ''] ?? '');
      case 'different':
        return String(value ?? '') !== String(this.data[params[0] ?? ''] ?? '');
      case 'in':
        return params.includes(String(value ?? ''));
      case 'not_in':
        return !params.includes(String(value ?? ''));
      case 'min':
        return this.sizeOf(value) >= Number(params[0]);
      case 'max':
        return this.sizeOf(value) <= Number(params[0]);
      case 'between':
        return this.sizeOf(value) >= Number(params[0]) && this.sizeOf(value) <= Number(params[1]);
      case 'size':
        return this.sizeOf(value) === Number(params[0]);
      case 'digits':
        return /^\d+$/.test(String(value ?? '')) && String(value).length === Number(params[0]);
      case 'digits_between':
        return /^\d+$/.test(String(value ?? '')) && this.sizeOf(value) >= Number(params[0]) && this.sizeOf(value) <= Number(params[1]);
      case 'exists':
        return this.dbExists(params, value);
      case 'unique':
        return this.dbUnique(field, params, value);
      case 'regex':
        try {
          return new RegExp(params.join('|')).test(String(value ?? ''));
        } catch {
          return true;
        }
      case 'ip':
        return typeof value === 'string' && isIP(value) !== 0;
      case 'json':
        if (typeof value !== 'string') return false;
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      case 'uuid':
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      default: {
        const custom = customRules.get(name);
        if (custom) {
          const result = await custom(value, params, this.data, field);
          if (result === true) return true;
          if (typeof result === 'string') {
            this.addError(field, result);
            return true; // message already recorded
          }
          return false;
        }
        // Unknown rules pass silently (Laravel ignores unrecognised rules).
        return true;
      }
    }
  }

  private async dbExists(params: string[], value: unknown): Promise<boolean> {
    const [table, column = 'id'] = params;
    const row = await this.db().table(table).where(column, value).first();
    return row !== undefined;
  }

  private async dbUnique(field: string, params: string[], value: unknown): Promise<boolean> {
    const [table, column = field, ignoreId, idColumn = 'id'] = params;
    const query = this.db().table(table).where(column, value);
    if (ignoreId && ignoreId !== 'null' && ignoreId !== '') {
      query.where(idColumn, '!=', ignoreId);
    }
    const row = await query.first();
    return row === undefined;
  }

  private sizeOf(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return value.length;
    return String(value).length;
  }

  private db(): DatabaseManager {
    return currentApp().make<DatabaseManager>('db');
  }

  private recordValidated(field: string, value: unknown): void {
    if (value !== undefined) this._validatedData[field] = value;
  }

  private addError(field: string, message: string): void {
    (this.errorBag[field] ??= []).push(message);
  }

  private message(field: string, rule: Rule): string {
    const custom = this.messages[`${field}.${rule.name}`] ?? this.messages[rule.name];
    if (custom) return replaceParams(custom, field, rule, this.attributes);
    const template = MESSAGES[rule.name] ?? MESSAGES.default;
    return replaceParams(template, field, rule, this.attributes);
  }
}

// --------------------------------------------------------------- rule parsing

function parseRules(ruleString: string): Rule[] {
  const rules: Rule[] = [];
  const parts = ruleString.split('|');
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const colon = part.indexOf(':');
    if (colon === -1) {
      rules.push({ name: part, params: [] });
      continue;
    }
    const name = part.slice(0, colon);
    const rawParams = part.slice(colon + 1);
    if (name === 'regex') {
      // regex: consumes the remainder (patterns may contain '|').
      rules.push({ name, params: [parts.slice(index).join('|').slice(part.indexOf(':') + 1)] });
      break;
    }
    rules.push({ name, params: rawParams.split(',').map((param) => param.trim()) });
  }
  return rules;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function replaceParams(
  template: string,
  field: string,
  rule: Rule,
  attributes: Record<string, string>,
): string {
  const attribute = attributes[field] ?? field.replaceAll('_', ' ').replaceAll('.', ' ');
  const params: Record<string, string> = {
    attribute,
    min: rule.params[0] ?? '',
    max: rule.params[1] ?? '',
    size: rule.params[0] ?? '',
    digits: rule.params[0] ?? '',
    other: attributes[rule.params[0] ?? ''] ?? (rule.params[0] ?? '').replaceAll('_', ' '),
    value: rule.params[0] ?? '',
    pattern: rule.params[0] ?? '',
  };
  return template.replace(/:(\w+)/g, (match, key: string) => params[key] ?? match);
}

// ---------------------------------------------------------------- messages

const MESSAGES: Record<string, string> = {
  default: 'The :attribute field is invalid.',
  required: 'The :attribute field is required.',
  required_if: 'The :attribute field is required when :other is :value.',
  string: 'The :attribute must be a string.',
  numeric: 'The :attribute must be a number.',
  integer: 'The :attribute must be an integer.',
  boolean: 'The :attribute field must be true or false.',
  array: 'The :attribute must be an array.',
  email: 'The :attribute must be a valid email address.',
  url: 'The :attribute format is invalid.',
  date: 'The :attribute is not a valid date.',
  alpha: 'The :attribute must only contain letters.',
  alpha_num: 'The :attribute must only contain letters and numbers.',
  alpha_dash: 'The :attribute must only contain letters, numbers, dashes and underscores.',
  confirmed: 'The :attribute confirmation does not match.',
  same: 'The :attribute and :other must match.',
  different: 'The :attribute and :other must differ.',
  in: 'The selected :attribute is invalid.',
  not_in: 'The selected :attribute is invalid.',
  min: 'The :attribute must be at least :min.',
  max: 'The :attribute must not be greater than :max.',
  between: 'The :attribute must be between :min and :max.',
  size: 'The :attribute must be :size.',
  digits: 'The :attribute must be :digits digits.',
  digits_between: 'The :attribute must be between :min and :max digits.',
  exists: 'The selected :attribute is invalid.',
  unique: 'The :attribute has already been taken.',
  regex: 'The :attribute format is invalid.',
  ip: 'The :attribute must be a valid IP address.',
  json: 'The :attribute must be a valid JSON string.',
  uuid: 'The :attribute must be a valid UUID.',
};

/** The Validator facade — Laravel's Validator::make(). */
export const Validator = {
  make(
    data: Record<string, unknown>,
    rules: Record<string, string>,
    messages: Record<string, string> = {},
    attributes: Record<string, string> = {},
  ): ValidatorInstance {
    return new ValidatorInstance(data, rules, messages, attributes);
  },

  /** Register a reusable custom rule (Laravel: Validator::extend(...)). */
  extend(name: string, callback: CustomRule): void {
    customRules.set(name, callback);
  },
};
