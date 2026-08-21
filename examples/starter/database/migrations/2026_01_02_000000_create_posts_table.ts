import { Schema } from '../../src/facades';

export async function up(): Promise<void> {
  await Schema.create('posts', (table) => {
    table.id();
    table.foreignId('user_id').constrained('users');
    table.string('title');
    table.text('body');
    table.timestamps();
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists('posts');
}
