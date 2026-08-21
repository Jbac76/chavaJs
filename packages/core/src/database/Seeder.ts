/**
 * Laravel's Seeder base:
 *
 *   export class DatabaseSeeder extends Seeder {
 *     public async run() {
 *       await this.call([UserSeeder]);
 *     }
 *   }
 */
export abstract class Seeder {
  /** Run the seeder. Override in subclasses. */
  public abstract run(): Promise<void> | void;

  /** Run other seeders (Laravel: $this->call([...])). */
  protected async call(seeders: Array<new () => Seeder>): Promise<void> {
    for (const SeederClass of seeders) {
      const seeder = new SeederClass();
      await seeder.run();
    }
  }
}
