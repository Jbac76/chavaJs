import { Schema } from '../../src/facades';

/**
 * Laravel's default jobs migration: a `jobs` table for the database queue
 * driver plus a `failed_jobs` table for exhausted jobs.
 */
export async function up(): Promise<void> {
  await Schema.create('jobs', (table) => {
    table.bigIncrements('id');
    table.string('queue').index();
    table.text('payload');
    table.integer('attempts').unsigned().default(0);
    table.integer('reserved_at').unsigned().nullable();
    table.integer('available_at').unsigned();
    table.integer('created_at').unsigned();
  });

  await Schema.create('failed_jobs', (table) => {
    table.bigIncrements('id');
    table.string('queue');
    table.text('payload');
    table.text('exception');
    table.timestamp('failed_at').nullable();
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists('failed_jobs');
  await Schema.dropIfExists('jobs');
}
