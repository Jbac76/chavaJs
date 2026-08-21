import { describe, expect, it } from 'vitest';
import { Config } from '../../src/config/Config';

describe('Config', () => {
  it('reads top-level and nested values via dot notation', () => {
    const config = new Config();
    config.load({ app: { name: 'chavaJs', debug: true }, mail: { host: 'smtp.example.com' } });

    expect(config.get('app.name')).toBe('chavaJs');
    expect(config.get('app.debug')).toBe(true);
    expect(config.get('mail.host')).toBe('smtp.example.com');
  });

  it('returns the fallback for missing keys', () => {
    const config = new Config();
    expect(config.get('missing.key', 'fallback')).toBe('fallback');
    expect(config.get('app.name', 'fallback')).toBe('fallback');
  });

  it('reports has() correctly', () => {
    const config = new Config();
    config.load({ app: { name: 'x' } });
    expect(config.has('app.name')).toBe(true);
    expect(config.has('app.nope')).toBe(false);
  });

  it('supports set() with deep merge on load()', () => {
    const config = new Config();
    config.set('services', { cache: 'redis' });
    config.load({ services: { queue: 'bullmq' }, app: { name: 'chavaJs' } });
    expect(config.get('services.cache')).toBe('redis');
    expect(config.get('services.queue')).toBe('bullmq');
    expect(config.get('app.name')).toBe('chavaJs');
  });
});
