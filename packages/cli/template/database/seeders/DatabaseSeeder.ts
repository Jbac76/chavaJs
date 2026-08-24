import { Seeder } from '../../src/database/Seeder';
import { Hash } from '../../src/auth/Hash';
import { User } from '../../app/Models/User';
import { PostFactory } from '../factories/PostFactory';
import { UserFactory } from '../factories/UserFactory';

/**
 * Idempotent demo seeder - safe to run any number of times.
 * Existing accounts are updated in place (Laravel: firstOrNew + save).
 */
export class DatabaseSeeder extends Seeder {
  public async run(): Promise<void> {
    const hashed = await Hash.make('password');

    // One admin + one member, both with the demo password 'password'.
    const admin = (await User.where('email', 'admin@chavajs.com').first()) ?? new User();
    admin.setAttribute('name', 'Admin User');
    admin.setAttribute('email', 'admin@chavajs.com');
    admin.setAttribute('password', hashed);
    admin.setAttribute('is_admin', true);
    admin.setAttribute('email_verified_at', new Date());
    // Hydrated instances save as UPDATE; fresh ones INSERT (Laravel save()).
    await admin.save();

    // A known non-admin account for demos / E2E.
    const member = (await User.where('email', 'member@chavajs.com').first()) ?? new User();
    member.setAttribute('name', 'Member User');
    member.setAttribute('email', 'member@chavajs.com');
    member.setAttribute('password', hashed);
    member.setAttribute('is_admin', false);
    member.setAttribute('email_verified_at', new Date());
    await member.save();

    // Posts for the two named accounts so every user has demo content.
    await PostFactory.new().count(2).for(admin).create();
    await PostFactory.new().count(2).for(member).create();

    // ~100 demo users for testing tables/filters/pagination. Every fifth
    // account stays unverified so the Status column has variety. Only on
    // first seed (keeps re-seeds fast and idempotent).
    const alreadySeeded = await User.where('email', 'like', '%@example.com').first();
    if (!alreadySeeded) {
      const regular = (await UserFactory.new().count(98).create()) as User[];
      for (const [index, user] of regular.entries()) {
        user.setAttribute('password', hashed);
        if (index % 5 !== 4) user.setAttribute('email_verified_at', new Date());
        await user.save();
        // ->for($user) sets user_id from the parent; two posts per user.
        await PostFactory.new().count(2).for(user).create();
      }
    }
  }
}
