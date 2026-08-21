import { describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';
import { cronMatches, describeCron } from '../../src/scheduling/Cron';
import { Scheduler } from '../../src/scheduling/Scheduler';

describe('Scheduler (Phase 5)', () => {
  describe('cron matching', () => {
    it('matches exact 5-field expressions', () => {
      const date = new Date(2026, 0, 15, 9, 30); // Thu Jan 15 09:30
      expect(cronMatches('* * * * *', date)).toBe(true);
      expect(cronMatches('30 9 * * *', date)).toBe(true);
      expect(cronMatches('0 9 * * *', date)).toBe(false); // minute mismatch
      expect(cronMatches('30 9 15 1 *', date)).toBe(true); // dom+month
      expect(cronMatches('30 9 * * 4', date)).toBe(true); // Thursday
      expect(cronMatches('30 9 * * 3', date)).toBe(false); // Wednesday
    });

    it('supports steps, ranges and lists', () => {
      expect(cronMatches('*/5 * * * *', new Date(2026, 0, 1, 0, 10))).toBe(true);
      expect(cronMatches('*/5 * * * *', new Date(2026, 0, 1, 0, 11))).toBe(false);
      expect(cronMatches('0 9-17 * * *', new Date(2026, 0, 1, 12, 0))).toBe(true);
      expect(cronMatches('0 9-17 * * *', new Date(2026, 0, 1, 18, 0))).toBe(false);
      expect(cronMatches('0,30 * * * *', new Date(2026, 0, 1, 5, 30))).toBe(true);
    });

    it('describes expressions in plain language', () => {
      expect(describeCron('* * * * *')).toContain('every minute');
      expect(describeCron('*/5 * * * *')).toContain('every 5 minutes');
    });
  });

  describe('frequency API', () => {
    it('runs only the events that are due right now', async () => {
      const app = await freshApp();
      // A bare scheduler — not the container's, so routes/console.ts tasks
      // registered for the real app don't leak into this assertion.
      const scheduler = new Scheduler(app);
      const ran: string[] = [];
      scheduler.call(() => ran.push('minute')).everyMinute();
      scheduler.call(() => ran.push('daily')).daily();

      const now = new Date(2026, 0, 15, 9, 30);
      expect(await scheduler.runDue(now)).toBe(1);
      expect(ran).toEqual(['minute']);
    });

    it('flags hourly/daily tasks due at the matching minute', async () => {
      const app = await freshApp();
      const scheduler = new Scheduler(app);
      const hourly = scheduler.call(() => undefined).hourlyAt(15);
      const daily = scheduler.call(() => undefined).dailyAt('08:05');

      expect(hourly.isDue(new Date(2026, 0, 1, 14, 15))).toBe(true);
      expect(hourly.isDue(new Date(2026, 0, 1, 14, 16))).toBe(false);
      expect(daily.isDue(new Date(2026, 0, 1, 8, 5))).toBe(true);
      expect(daily.isDue(new Date(2026, 0, 1, 8, 6))).toBe(false);
    });

    it('honours the between() time window', async () => {
      const app = await freshApp();
      const scheduler = new Scheduler(app);
      const event = scheduler.call(() => undefined).between('09:00', '17:00').hourly();

      expect(event.isDue(new Date(2026, 0, 1, 10, 0))).toBe(true);
      expect(event.isDue(new Date(2026, 0, 1, 18, 0))).toBe(false);
      expect(event.isDue(new Date(2026, 0, 1, 8, 0))).toBe(false);
    });
  });
});
