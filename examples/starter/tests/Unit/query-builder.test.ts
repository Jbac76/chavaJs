import { describe, expect, it } from 'vitest';
import { Application } from '../../src/foundation/Application';
import { DatabaseManager } from '../../src/database/DatabaseManager';

function makeBuilder(): DatabaseManager {
  const app = new Application({ basePath: process.cwd() });
  return new DatabaseManager(app);
}

describe('Query Builder', () => {
  it('compiles a simple select with bindings', () => {
    const { sql, bindings } = makeBuilder()
      .table('users')
      .where('active', true)
      .orderBy('name')
      .limit(5)
      .toSql();

    expect(sql).toBe('select * from "users" where "active" = ? order by "name" asc limit ?');
    expect(bindings).toEqual([true, 5]);
  });

  it('compiles whereIn, whereNull and orWhere', () => {
    const { sql, bindings } = makeBuilder()
      .table('users')
      .whereIn('id', [1, 2, 3])
      .whereNull('deleted_at')
      .orWhere('admin', true)
      .toSql();

    expect(sql).toBe('select * from "users" where "id" in (?, ?, ?) and "deleted_at" is null or "admin" = ?');
    expect(bindings).toEqual([1, 2, 3, true]);
  });

  it('compiles nested where closures in parentheses', () => {
    const { sql, bindings } = makeBuilder()
      .table('users')
      .where((query) => query.where('age', '>', 18).orWhere('is_admin', true))
      .toSql();

    expect(sql).toContain('("age" > ? or "is_admin" = ?)');
    expect(bindings).toEqual([18, true]);
  });

  it('compiles joins and quoted identifiers', () => {
    const { sql } = makeBuilder()
      .table('posts')
      .join('users', 'posts.user_id', '=', 'users.id')
      .toSql();

    expect(sql).toContain('join "users" on "posts"."user_id" = "users"."id"');
  });

  it('compiles whereNot and whereBetween', () => {
    const { sql, bindings } = makeBuilder()
      .table('products')
      .whereNot('stock', '=', 0)
      .whereBetween('price', [10, 100])
      .toSql();

    expect(sql).toContain('not ("stock" = ?)');
    expect(sql).toContain('"price" between ? and ?');
    expect(bindings).toEqual([0, 10, 100]);
  });

  it('compiles inRandomOrder() without quoting the function', () => {
    const { sql } = makeBuilder().table('users').inRandomOrder().toSql();
    expect(sql).toContain('order by RANDOM() asc');
  });

  it('compiles distinct selects and group/order/having', () => {
    const { sql, bindings } = makeBuilder()
      .table('orders')
      .distinct()
      .select('user_id')
      .groupBy('user_id')
      .having('user_id', '>', 5)
      .orderByDesc('user_id')
      .toSql();

    expect(sql).toContain('select distinct "user_id" from "orders"');
    expect(sql).toContain('group by "user_id"');
    expect(sql).toContain('having "user_id" > ?');
    expect(sql).toContain('order by "user_id" desc');
    expect(bindings).toEqual([5]);
  });
});
