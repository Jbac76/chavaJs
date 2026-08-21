import { Schema } from '../../src/facades';

export async function up(): Promise<void> {
  await Schema.create('personal_access_tokens', (table) => {
    table.id();
    table.foreignId('user_id').constrained('users').index();
    table.string('name');
    table.string('token', 64).unique();
    table.json('abilities');
    table.timestamp('last_used_at').nullable();
    table.timestamp('expires_at').nullable();
    table.timestamps();
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists('personal_access_tokens');
}
