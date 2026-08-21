import { Seeder } from '../../src/database/Seeder';
import { Hash } from '../../src/auth/Hash';
import { User } from '../../app/Models/User';
import { PostFactory } from '../factories/PostFactory';
import { UserFactory } from '../factories/UserFactory';

export class DatabaseSeeder extends Seeder {
  public async run(): Promise<void> {
    const hashed = await Hash.make('password');

    // One admin + 7 regular users — all with the demo password 'password'.
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@chava.dev',
      password: hashed,
      is_admin: true,
      email_verified_at: new Date(),
    });

    // A known non-admin account for demos / E2E: member@chava.dev / password.
    const member = await User.create({
      name: 'Member User',
      email: 'member@chava.dev',
      password: hashed,
      is_admin: false,
      email_verified_at: new Date(),
    });

    const regular = (await UserFactory.new().count(6).create()) as User[];
    const users = [admin, member, ...regular];

    for (const user of users) {
      if (user !== admin) {
        user.setAttribute('password', hashed);
        user.setAttribute('email_verified_at', new Date());
        await user.save();
      }
      // ->for($user) sets user_id from the parent; two posts per user.
      await PostFactory.new().count(2).for(user).create();
    }
  }
}
