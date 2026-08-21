import { Schema } from '../../src/facades';

/**
 * Laravel's default notifications migration: stores database-channel
 * notifications, morph-related to the notifiable model.
 */
export async function up(): Promise<void> {
  await Schema.create('notifications', (table) => {
    table.uuid('id').primary();
    table.string('type');
    table.string('notifiable_type');
    table.bigInteger('notifiable_id').unsigned();
    table.text('data');
    table.timestamp('read_at').nullable();
    table.timestamps();
    table.index(['notifiable_type', 'notifiable_id']);
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists('notifications');
}
