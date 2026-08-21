import { faker } from '@faker-js/faker';
import { Factory } from '../../src/orm/Factory';
import { User } from '../../app/Models/User';

export class UserFactory extends Factory<User> {
  protected model = User;

  public definition() {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      password: 'password', // replaced with a Hash in the seeder
      is_admin: false,
    };
  }
}
