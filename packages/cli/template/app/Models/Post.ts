import { Model } from '../../src/orm/Model';
import { User } from './User';

export class Post extends Model {
  public static fillable: string[] = ['user_id', 'title', 'body'];

  /** Inverse one-to-many: a post belongs to a user. */
  public user() {
    return this.belongsTo(User);
  }
}
