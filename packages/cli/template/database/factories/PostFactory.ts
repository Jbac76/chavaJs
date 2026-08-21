import { faker } from '@faker-js/faker';
import { Factory } from '../../src/orm/Factory';
import { Post } from '../../app/Models/Post';

export class PostFactory extends Factory<Post> {
  protected model = Post;

  public definition() {
    return {
      title: faker.lorem.sentence(5),
      body: faker.lorem.paragraphs(2),
    };
  }
}
