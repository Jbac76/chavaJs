process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = ':memory:';

import { describe, expect, it } from 'vitest';
import { Validator } from '../../src/validation/Validator';

describe('Validator (Phase 4)', () => {
  it('passes valid data and returns the validated payload', async () => {
    const validator = Validator.make(
      { name: 'Taylor', email: 'taylor@chava.dev', age: 30 },
      { name: 'required|string|max:255', email: 'required|email', age: 'integer|min:18' },
    );
    expect(await validator.passes()).toBe(true);
    expect(validator.validated()).toEqual({ name: 'Taylor', email: 'taylor@chava.dev', age: 30 });
  });

  it('fails required/email/max rules with Laravel-style errors', async () => {
    const validator = Validator.make(
      { name: '', email: 'not-an-email', password: '123' },
      { name: 'required', email: 'email', password: 'min:8' },
    );
    expect(await validator.fails()).toBe(true);
    const errors = validator.errors();
    expect(errors.name[0]).toContain('required');
    expect(errors.email[0]).toContain('valid email');
    expect(errors.password[0]).toContain('at least 8');
  });

  it('short-circuits a field when required fails', async () => {
    const validator = Validator.make({ email: '' }, { email: 'required|email|max:255' });
    expect(await validator.fails()).toBe(true);
    expect(validator.errors().email).toHaveLength(1);
    expect(validator.errors().email[0]).toContain('required');
  });

  it('validates confirmed fields', async () => {
    const ok = Validator.make(
      { password: 'secret123', password_confirmation: 'secret123' },
      { password: 'required|confirmed' },
    );
    const bad = Validator.make(
      { password: 'secret123', password_confirmation: 'different' },
      { password: 'required|confirmed' },
    );
    expect(await ok.passes()).toBe(true);
    expect(await bad.fails()).toBe(true);
  });

  it('supports in/not_in and between rules', async () => {
    const ok = Validator.make({ role: 'admin', score: 5 }, { role: 'in:admin,user', score: 'between:1,10' });
    const bad = Validator.make({ role: 'superuser' }, { role: 'in:admin,user' });
    expect(await ok.passes()).toBe(true);
    expect(await bad.fails()).toBe(true);
  });

  it('ignores empty optional fields (Laravel behaviour)', async () => {
    const validator = Validator.make({ name: 'Taylor', bio: '' }, { name: 'required', bio: 'max:500' });
    expect(await validator.passes()).toBe(true);
    expect(validator.validated()).not.toHaveProperty('bio');
  });

  it('supports custom attribute names in messages', async () => {
    const validator = Validator.make(
      { name: '' },
      { name: 'required' },
      {},
      { name: 'display name' },
    );
    await validator.fails();
    expect(validator.errors().name[0]).toContain('display name');
  });

  it('supports custom messages and custom rules', async () => {
    Validator.extend('even', (value: unknown) => typeof value === 'number' && value % 2 === 0);
    const custom = Validator.make({ n: 3 }, { n: 'even' }, { even: 'The :attribute must be even.' });
    expect(await custom.fails()).toBe(true);
    expect(custom.errors().n[0]).toBe('The n must be even.');
  });

  it('throws ValidationException via validate()', async () => {
    const validator = Validator.make({ email: 'bad' }, { email: 'required|email' });
    await expect(validator.validate()).rejects.toThrowError('The given data was invalid.');
  });
});
