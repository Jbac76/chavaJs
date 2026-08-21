import { Command } from 'commander';
import type { DatabaseManager } from '../../database/DatabaseManager';
import type { Row } from '../../database/types';
import { bootApp } from '../helpers/boot-app';

/**
 * Laravel's queue:failed — list the failed jobs from the failed_jobs table.
 */
export function queueFailedCommand(): Command {
  return new Command('queue:failed')
    .description('List the failed jobs')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const db = app.make<DatabaseManager>('db');

      const rows = (await db.table('failed_jobs')
        .orderBy('id', 'desc')
        .limit(50)
        .get()) as Row[];

      if (rows.length === 0) {
        console.log('  No failed jobs.');
        return;
      }

      const widths = {
        id: Math.max(...rows.map((r) => String(r.id).length), 'ID'.length),
        queue: Math.max(...rows.map((r) => String(r.queue).length), 'QUEUE'.length),
        payload: Math.max(...rows.map((r) => truncate(String(r.payload), 60).length), 'PAYLOAD'.length),
        exception: Math.max(...rows.map((r) => truncate(String(r.exception), 60).length), 'EXCEPTION'.length),
        failed_at: Math.max(...rows.map((r) => formatDate(r.failed_at).length), 'FAILED AT'.length),
      };

      const header = ['ID', 'QUEUE', 'PAYLOAD', 'EXCEPTION', 'FAILED AT']
        .map((label, i) => label.padEnd(Object.values(widths)[i]))
        .join('  ');

      console.log(header);
      console.log('-'.repeat(header.length));
      for (const row of rows) {
        console.log(
          [
            String(row.id),
            String(row.queue),
            truncate(String(row.payload), 60),
            truncate(String(row.exception), 60),
            formatDate(row.failed_at),
          ]
            .map((cell, i) => cell.padEnd(Object.values(widths)[i]))
            .join('  '),
        );
      }

      console.log(`\n  Showing ${rows.length} failed job(s).`);
    });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '';
  const ts = Number(value as string | number);
  if (Number.isNaN(ts)) return String(value);
  const d = new Date(ts * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}
