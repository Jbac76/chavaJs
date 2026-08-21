import { Schema } from '../../src/facades';

export async function up(): Promise<void> {
  await Schema.create('users', (table) => {
    table.id();
    table.string('name');
    table.string('email').unique();
    table.string('password');
    table.boolean('is_admin').default(false);
    table.timestamp('email_verified_at').nullable();
    table.timestamps();
    table.softDeletes();
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists('users');
}
