import { currentApp } from '../foundation/registry';
import { DatabaseManager } from '../database/DatabaseManager';
import { Builder } from '../database/query/Builder';
import type { Paginator } from '../database/query/Builder';
import type { Row } from '../database/types';
import { isClass } from '../support/reflect';
import { NotFoundException } from '../support/exceptions';
import { BelongsTo } from './relations/BelongsTo';
import { BelongsToMany } from './relations/BelongsToMany';
import { HasMany } from './relations/HasMany';
import { HasManyThrough } from './relations/HasManyThrough';
import { HasOne } from './relations/HasOne';
import { MorphOneOrMany } from './relations/MorphOneOrMany';
import { MorphTo } from './relations/MorphTo';
import { Relation } from './relations/Relation';

export type CastType =
  | 'int'
  | 'integer'
  | 'float'
  | 'double'
  | 'bool'
  | 'boolean'
  | 'string'
  | 'json'
  | 'array'
  | 'object'
  | 'datetime'
  | 'date'
  | 'timestamp';

export type ModelEvent =
  | 'creating'
  | 'created'
  | 'updating'
  | 'updated'
  | 'saving'
  | 'saved'
  | 'deleting'
  | 'deleted'
  | 'restoring'
  | 'restored';

const BEFORE_EVENTS = new Set<ModelEvent>(['creating', 'saving', 'updating', 'deleting', 'restoring']);

export interface ModelClass<T extends Model = Model> {
  new (attributes?: Record<string, unknown>): T;
  readonly tableName?: string;
  readonly primaryKey: string;
  readonly keyType: 'int' | 'string';
  readonly incrementing: boolean;
  readonly timestamps: boolean;
  readonly createdAtColumn: string;
  readonly updatedAtColumn: string;
  readonly softDeletes: boolean;
  readonly softDeleteColumn: string;
  readonly fillable: string[];
  readonly guarded: string[];
  readonly hidden: string[];
  readonly casts: Record<string, CastType>;
  readonly morphClass?: string;
  readonly name: string;
  getTable(): string;
  getKeyName(): string;
  getMorphClass(): string;
  query(): Builder<Model>;
  where(...args: unknown[]): Builder<Model>;
  find(id: unknown): Promise<Model | undefined>;
  findOrFail(id: unknown): Promise<Model>;
  first(): Promise<Model | undefined>;
  firstOrFail(): Promise<Model>;
  all(): Promise<Model[]>;
  create(attributes: Record<string, unknown>): Promise<Model>;
  firstOrCreate(attributes: Record<string, unknown>, values?: Record<string, unknown>): Promise<Model>;
  updateOrCreate(attributes: Record<string, unknown>, values?: Record<string, unknown>): Promise<Model>;
  with(...relations: string[]): Builder<Model>;
  withTrashed(): Builder<Model>;
  onlyTrashed(): Builder<Model>;
  count(): Promise<number>;
  newFromBuilder(row: Row): Model;
  newInstance(attributes?: Record<string, unknown>): Model;
  createRaw(attributes: Record<string, unknown>): Promise<Model>;
  observe(observer: object): void;
  on(event: string, callback: (model: Model) => unknown): void;
}

// ------------------------------------------------------------------ registry

const listenersByClass = new Map<string, Map<string, Array<(model: Model) => unknown>>>();
const observersByClass = new Map<string, unknown[]>();
const morphMap = new Map<string, ModelClass>();

function listenersFor(className: string): Map<string, Array<(model: Model) => unknown>> {
  let listeners = listenersByClass.get(className);
  if (!listeners) {
    listeners = new Map();
    listenersByClass.set(className, listeners);
  }
  return listeners;
}

function observersFor(className: string): unknown[] {
  let observers = observersByClass.get(className);
  if (!observers) {
    observers = [];
    observersByClass.set(className, observers);
  }
  return observers;
}

/**
 * Active Record Model — the Eloquent equivalent:
 *
 *   const user = await User.find(1);
 *   user.name = 'Taylor';
 *   await user.save();
 *   const users = await User.with('posts').get();
 *
 * Attribute access is direct (`user.name`) thanks to per-attribute property
 * accessors installed at hydration; casts, accessors and mutators apply on
 * read/write. Relations are loaded with `with()`/`load()` and then accessed
 * as properties (`user.posts`), or queried as methods (`user.posts()`).
 */
export class Model {
  // ------------------------------------------------------------ configuration

  public static tableName?: string;
  public static primaryKey = 'id';
  public static keyType: 'int' | 'string' = 'int';
  public static incrementing = true;
  public static timestamps = true;
  public static createdAtColumn = 'created_at';
  public static updatedAtColumn = 'updated_at';
  public static softDeletes = false;
  public static softDeleteColumn = 'deleted_at';
  public static fillable: string[] = [];
  public static guarded: string[] = [];
  public static hidden: string[] = [];
  public static casts: Record<string, CastType> = {};
  public static morphClass?: string;

  // -------------------------------------------------------------- internal state

  protected _attributes: Record<string, unknown> = {};
  protected _original: Record<string, unknown> = {};
  protected _dirty = new Set<string>();
  protected _exists = false;
  protected _wasRecentlyCreated = false;
  protected _relations: Record<string, unknown> = {};

  /**
   * Dynamic per-attribute properties (`user.name`, `user.posts`) installed at
   * hydration — Laravel's magic `$attributes` access, typed as unknown.
   */
  [attribute: string]: unknown;

  public constructor(attributes: Record<string, unknown> = {}) {
    if (Object.keys(attributes).length > 0) {
      this.hydrateAttributes(attributes);
      this._original = { ...this._attributes };
    }
    this.installAccessors();
  }

  // ------------------------------------------------------------ connection

  protected static db(): DatabaseManager {
    return currentApp().make<DatabaseManager>('db');
  }

  public static getConnection(): DatabaseManager {
    return Model.db();
  }

  // ------------------------------------------------------------------ table

  public static getTable(): string {
    if (this.tableName) return this.tableName;
    const snake = snakeCase(this.name);
    return pluralize(snake);
  }

  public getTable(): string {
    return (this.constructor as ModelClass).getTable();
  }

  public static getKeyName(): string {
    return this.primaryKey;
  }

  public getKeyName(): string {
    return (this.constructor as ModelClass).primaryKey;
  }

  public getKey(): unknown {
    return this.getAttribute(this.getKeyName());
  }

  public static getMorphClass(): string {
    return this.morphClass ?? this.name;
  }

  // --------------------------------------------------------------- queries

  public static query(): Builder<Model> {
    return new Builder<Model>(Model.db()).from(this.getTable()).setModel(this as unknown as ModelClass);
  }

  public static where(...args: unknown[]): Builder<Model> {
    return this.query().where(
      ...(args as [string | Record<string, unknown> | ((query: Builder) => void), unknown, unknown]),
    );
  }

  public static find(id: unknown) {
    return this.query().where(this.primaryKey, id).first();
  }

  public static async findOrFail(id: unknown) {
    const result = await this.find(id);
    if (result === undefined) {
      throw new NotFoundException(`No query results for model [${this.name}] with id [${String(id)}].`);
    }
    return result;
  }

  public static first() {
    return this.query().first();
  }

  public static firstOrFail() {
    return this.query().firstOrFail();
  }

  public static all() {
    return this.query().get();
  }

  public static with(...relations: string[]): Builder<Model> {
    return this.query().with(...relations);
  }

  /** Include soft-deleted rows (Laravel: User::withTrashed()). */
  public static withTrashed(): Builder<Model> {
    return this.query().withTrashed();
  }

  /** Only soft-deleted rows (Laravel: User::onlyTrashed()). */
  public static onlyTrashed(): Builder<Model> {
    return this.query().onlyTrashed();
  }

  public static count(): Promise<number> {
    return this.query().count();
  }

  // ------------------------------------------------ static query passthroughs

  public static orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): Builder<Model> {
    return this.query().orderBy(column, direction);
  }

  public static orderByDesc(column: string): Builder<Model> {
    return this.query().orderByDesc(column);
  }

  public static latest(column = 'created_at'): Builder<Model> {
    return this.query().latest(column);
  }

  public static oldest(column = 'created_at'): Builder<Model> {
    return this.query().oldest(column);
  }

  public static limit(limit: number): Builder<Model> {
    return this.query().limit(limit);
  }

  public static take(limit: number): Builder<Model> {
    return this.query().take(limit);
  }

  public static get(): Promise<Model[]> {
    return this.query().get();
  }

  public static paginate(perPage = 15, page = 1): Promise<Paginator<Model>> {
    return this.query().paginate(perPage, page);
  }

  public static chunk(size: number, callback: (items: Model[], page: number) => boolean | void): Promise<void> {
    return this.query().chunk(size, callback);
  }

  public static pluck(column: string): Promise<unknown[]> {
    return this.query().pluck(column);
  }

  public static value(column: string): Promise<unknown> {
    return this.query().value(column);
  }

  public static min(column: string): Promise<number | null> {
    return this.query().min(column);
  }

  public static max(column: string): Promise<number | null> {
    return this.query().max(column);
  }

  public static sum(column: string): Promise<number> {
    return this.query().sum(column);
  }

  public static avg(column: string): Promise<number | null> {
    return this.query().avg(column);
  }

  public static async create(attributes: Record<string, unknown>): Promise<Model> {
    const instance = new this();
    instance.fill(attributes);
    await instance.save();
    return instance;
  }

  public static async firstOrCreate(attributes: Record<string, unknown>, values: Record<string, unknown> = {}) {
    const query = this.query();
    for (const [key, value] of Object.entries(attributes)) {
      query.where(key, value);
    }
    const existing = await query.first();
    if (existing) return existing;
    return this.create({ ...attributes, ...values });
  }

  public static async updateOrCreate(attributes: Record<string, unknown>, values: Record<string, unknown> = {}) {
    const query = this.query();
    for (const [key, value] of Object.entries(attributes)) {
      query.where(key, value);
    }
    const existing = await query.first();
    if (existing) {
      existing.fill(values);
      await existing.save();
      return existing;
    }
    return this.create({ ...attributes, ...values });
  }

  // ------------------------------------------------------------ hydration

  /** Build a model from a raw DB row, installing property accessors. */
  public static newFromBuilder(row: Row): Model {
    const instance = new this();
    instance.hydrateAttributes(row);
    instance._original = { ...instance._attributes };
    instance._exists = true;
    return instance;
  }

  private hydrateAttributes(row: Row): void {
    for (const [name, value] of Object.entries(row)) {
      this.setAttributeRaw(name, value);
      this.defineAttributeProperty(name);
    }
  }

  private defineAttributeProperty(name: string): void {
    Object.defineProperty(this, name, {
      get: () => this.readAttribute(name),
      set: (value: unknown) => this.setAttribute(name, value),
      enumerable: true,
      configurable: true,
    });
  }

  private installAccessors(): void {
    const prototype = Object.getPrototypeOf(this);
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const accessor = ACCESSOR_RE.exec(name);
      if (!accessor) continue;
      const attributeName = snakeCase(accessor[1]);
      if (attributeName in this) continue;
      Object.defineProperty(this, attributeName, {
        get: () => this.callAccessor(attributeName),
        set: (value: unknown) => this.callMutator(attributeName, value),
        enumerable: true,
        configurable: true,
      });
    }
  }

  // -------------------------------------------------------------- attributes

  /** Access the raw attribute map (used by relations for pivot hydration). */
  public rawAttributes(): Record<string, unknown> {
    return this._attributes;
  }

  public getAttribute(name: string): unknown {
    if (name in this._attributes) {
      return this.readAttribute(name);
    }
    const accessor = this.findAccessor(name);
    if (accessor) return this.callAccessor(name);
    return this._relations[name];
  }

  public setAttribute(name: string, value: unknown): this {
    const mutator = this.findMutator(name);
    if (mutator) {
      value = mutator.call(this, value);
    }
    this.setAttributeRaw(name, value);
    this.defineAttributeProperty(name);
    this._dirty.add(name);
    return this;
  }

  private readAttribute(name: string): unknown {
    const raw = this._attributes[name];
    const casted = this.castValue(name, raw);
    const accessor = this.findAccessor(name);
    return accessor ? accessor.call(this, casted) : casted;
  }

  private setAttributeRaw(name: string, value: unknown): void {
    this._attributes[name] = value;
  }

  private castValue(name: string, value: unknown): unknown {
    const cast = (this.constructor as ModelClass).casts[name];
    if (!cast || value === null || value === undefined) return value;
    switch (cast) {
      case 'int':
      case 'integer':
        return parseInt(String(value), 10);
      case 'float':
      case 'double':
        return Number(value);
      case 'bool':
      case 'boolean':
        return value === true || value === 1 || value === '1';
      case 'string':
        return String(value);
      case 'json':
      case 'array':
      case 'object': {
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        }
        return value;
      }
      case 'datetime':
      case 'date':
      case 'timestamp':
        return new Date(String(value));
      default:
        return value;
    }
  }

  private findAccessor(name: string): ((value: unknown) => unknown) | undefined {
    const methodName = `get${pascalCase(name)}Attribute`;
    const method = (this as unknown as Record<string, unknown>)[methodName];
    return typeof method === 'function' ? (method as (value: unknown) => unknown) : undefined;
  }

  private findMutator(name: string): ((value: unknown) => unknown) | undefined {
    const methodName = `set${pascalCase(name)}Attribute`;
    const method = (this as unknown as Record<string, unknown>)[methodName];
    return typeof method === 'function' ? (method as (value: unknown) => unknown) : undefined;
  }

  private callAccessor(name: string): unknown {
    const accessor = this.findAccessor(name);
    if (accessor) return accessor.call(this, this._attributes[name]);
    return this.castValue(name, this._attributes[name]);
  }

  private callMutator(name: string, value: unknown): void {
    const mutator = this.findMutator(name);
    this.setAttributeRaw(name, mutator ? mutator.call(this, value) : value);
    this._dirty.add(name);
  }

  // ------------------------------------------------------------ mass assignment

  /** Mass-assign attributes, respecting fillable/guarded. */
  public fill(attributes: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(attributes)) {
      if (this.isFillable(key)) this.setAttribute(key, value);
    }
    return this;
  }

  public forceFill(attributes: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(attributes)) {
      this.setAttribute(key, value);
    }
    return this;
  }

  private isFillable(key: string): boolean {
    const modelClass = this.constructor as ModelClass;
    if (modelClass.fillable.length > 0) return modelClass.fillable.includes(key);
    // When both fillable and guarded are empty, block all mass assignment
    // (Laravel defaults to guarding everything when neither is configured).
    // Set guarded = [] explicitly to allow all attributes.
    if (modelClass.guarded.length === 0) return false;
    return !modelClass.guarded.includes(key) && !modelClass.guarded.includes('*');
  }

  // ------------------------------------------------------------ dirty tracking

  public isDirty(name?: string): boolean {
    if (name) return this._dirty.has(name);
    return this._dirty.size > 0;
  }

  public getDirty(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const name of this._dirty) out[name] = this._attributes[name];
    return out;
  }

  public getOriginal(name?: string): unknown {
    if (name) return this._original[name];
    return { ...this._original };
  }

  public wasChanged(name?: string): boolean {
    return name ? this.getOriginal(name) !== this._attributes[name] : this.isDirty();
  }

  // --------------------------------------------------------------- persistence

  public async save(): Promise<this> {
    if ((await this.fireModelEvent('saving')) === false) return this;

    if (this._exists) {
      if ((await this.fireModelEvent('updating')) === false) return this;
      const updatedAt = (this.constructor as ModelClass).updatedAtColumn;
      if ((this.constructor as ModelClass).timestamps) {
        this.setAttribute(updatedAt, new Date());
      }
      const dirty = this.getDirty();
      if (Object.keys(dirty).length > 0) {
        const keyName = this.getKeyName();
        const query = Model.db().table(this.getTable()).where(keyName, this.getKey());
        await query.update(serializeAttributes(dirty, (this.constructor as ModelClass).casts));
        this._original = { ...this._attributes };
        this._dirty.clear();
        await this.fireModelEvent('updated');
      }
      await this.fireModelEvent('saved');
      return this;
    }

    if ((await this.fireModelEvent('creating')) === false) return this;
    const modelClass = this.constructor as ModelClass;
    if (modelClass.timestamps) {
      const now = new Date();
      this.setAttribute(modelClass.createdAtColumn, now);
      this.setAttribute(modelClass.updatedAtColumn, now);
    }
    const attributes = serializeAttributes(this._attributes, modelClass.casts);
    const id = await Model.db().table(this.getTable()).insertGetId(attributes);
    if (modelClass.incrementing) {
      this.setAttributeRaw(modelClass.primaryKey, id);
      this.defineAttributeProperty(modelClass.primaryKey);
    }
    this._exists = true;
    this._wasRecentlyCreated = true;
    this._original = { ...this._attributes };
    this._dirty.clear();
    await this.fireModelEvent('created');
    await this.fireModelEvent('saved');
    return this;
  }

  public async update(attributes: Record<string, unknown>): Promise<this> {
    this.fill(attributes);
    return this.save();
  }

  /** Delete the model (soft-deletes when the model uses them). */
  public async delete(): Promise<boolean> {
    if ((await this.fireModelEvent('deleting')) === false) return false;
    const modelClass = this.constructor as ModelClass;
    const query = Model.db().table(this.getTable()).where(this.getKeyName(), this.getKey());

    if (modelClass.softDeletes) {
      const deletedAt = new Date();
      this.setAttribute(modelClass.softDeleteColumn, deletedAt);
      await query.update(serializeAttributes({ [modelClass.softDeleteColumn]: deletedAt }, modelClass.casts));
      await this.fireModelEvent('deleted');
      return true;
    }

    await query.forceDelete();
    this._exists = false;
    await this.fireModelEvent('deleted');
    return true;
  }

  public trashed(): boolean {
    const value = this.getAttribute((this.constructor as ModelClass).softDeleteColumn);
    return value !== null && value !== undefined;
  }

  /** Restore a soft-deleted model. */
  public async restore(): Promise<this> {
    if ((await this.fireModelEvent('restoring')) === false) return this;
    const column = (this.constructor as ModelClass).softDeleteColumn;
    this.setAttribute(column, null);
    await Model.db().table(this.getTable()).where(this.getKeyName(), this.getKey()).update(
      serializeAttributes({ [column]: null }, (this.constructor as ModelClass).casts),
    );
    this._dirty.clear();
    await this.fireModelEvent('restored');
    return this;
  }

  /** Permanently delete, bypassing soft deletes. */
  public async forceDelete(): Promise<boolean> {
    await Model.db().table(this.getTable()).where(this.getKeyName(), this.getKey()).forceDelete();
    this._exists = false;
    return true;
  }

  public exists(): boolean {
    return this._exists;
  }

  public wasRecentlyCreated(): boolean {
    return this._wasRecentlyCreated;
  }

  // ------------------------------------------------------------- relations

  /** Get the Relation object for a relation method name. */
  public relationInstance(name: string): Relation | undefined {
    const method = (this as unknown as Record<string, unknown>)[name];
    if (typeof method !== 'function') return undefined;
    const relation = method.call(this);
    return relation instanceof Relation ? relation : undefined;
  }

  public getRelation(name: string): unknown {
    return this._relations[name];
  }

  /** Store loaded relation data and expose it as a property. */
  public setRelation(name: string, value: unknown): this {
    this._relations[name] = value;
    Object.defineProperty(this, name, {
      get: () => this._relations[name],
      enumerable: true,
      configurable: true,
    });
    return this;
  }

  /** Lazy eager loading (Laravel: $user->load('posts')). */
  public async load(...relations: string[]): Promise<this> {
    const related = await this.loadRelations([this], relations);
    void related;
    return this;
  }

  protected async loadRelations(models: Model[], relations: string[]): Promise<Model[]> {
    for (const relation of relations) {
      const [name, ...rest] = relation.split('.');
      const relationInstance = models[0]?.relationInstance(name);
      if (!relationInstance) continue;
      await relationInstance.eagerLoad(models, name);
      if (rest.length > 0) {
        const nested = models.flatMap((model) => (model.getRelation(name) as Model[] | undefined) ?? []);
        if (nested.length > 0) {
          await this.loadRelations(nested, [rest.join('.')]);
        }
      }
    }
    return models;
  }

  // ------------------------------------------------------------ relations

  /** One-to-many: $user->hasMany(Post::class, 'user_id'). */
  public hasMany(related: ModelClass, foreignKey?: string, localKey = 'id'): HasMany {
    return new HasMany(this, related, foreignKey ?? `${snakeCase(this.constructor.name)}_id`, localKey);
  }

  /** One-to-one: $user->hasOne(Profile::class, 'user_id'). */
  public hasOne(related: ModelClass, foreignKey?: string, localKey = 'id'): HasOne {
    return new HasOne(this, related, foreignKey ?? `${snakeCase(this.constructor.name)}_id`, localKey);
  }

  /** Inverse one-to-one/one-to-many: $post->belongsTo(User::class, 'user_id'). */
  public belongsTo(related: ModelClass, foreignKey?: string, ownerKey = 'id'): BelongsTo {
    return new BelongsTo(this, related, foreignKey ?? `${snakeCase(related.name)}_id`, ownerKey);
  }

  /** Many-to-many with a pivot table: $user->belongsToMany(Role::class). */
  public belongsToMany(
    related: ModelClass,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey = 'id',
    relatedKey = 'id',
  ): BelongsToMany {
    return new BelongsToMany(this, related, pivotTable, foreignPivotKey, relatedPivotKey, parentKey, relatedKey);
  }

  /** Has-many-through: $country->hasManyThrough(Post::class, User::class). */
  public hasManyThrough(
    related: ModelClass,
    through: ModelClass,
    firstKey?: string,
    secondKey?: string,
    localKey = 'id',
    throughKey = 'id',
  ): HasManyThrough {
    return new HasManyThrough(
      this,
      related,
      through,
      firstKey ?? `${snakeCase(through.name)}_id`,
      secondKey ?? `${snakeCase(related.name)}_id`,
      localKey,
      throughKey,
    );
  }

  /** Polymorphic one-to-many: $post->morphMany(Image::class, 'imageable'). */
  public morphMany(related: ModelClass, name: string, typeColumn?: string, idColumn?: string): MorphOneOrMany {
    return new MorphOneOrMany(
      this,
      related,
      name,
      typeColumn ?? `${name}_type`,
      idColumn ?? `${name}_id`,
    );
  }

  /** Polymorphic inverse: $image->morphTo('imageable'). */
  public morphTo(name: string, typeColumn?: string, idColumn?: string): MorphTo {
    return new MorphTo(this, this.constructor as ModelClass, name, typeColumn ?? `${name}_type`, idColumn ?? `${name}_id`);
  }

  // ------------------------------------------------------------------ events

  /** Register a model event listener (Laravel: Model::created(fn)). */
  public static on(event: string, callback: (model: Model) => unknown): void {
    const listeners = listenersFor(this.name);
    const list = listeners.get(event) ?? [];
    list.push(callback);
    listeners.set(event, list);
  }

  /** Register an observer class/instance (Laravel: Model::observe(UserObserver::class)). */
  public static observe(observer: object): void {
    observersFor(this.name).push(observer);
  }

  protected async fireModelEvent(event: ModelEvent): Promise<boolean> {
    const className = this.constructor.name;
    const results: unknown[] = [];

    for (const observer of observersFor(className)) {
      const target = isClass(observer) ? currentApp().make(observer) : observer;
      const method = (target as Record<string, unknown>)[event];
      if (typeof method === 'function') {
        results.push(await (method as (model: Model) => unknown).call(target, this));
      }
    }
    for (const listener of listenersFor(className).get(event) ?? []) {
      results.push(await listener(this));
    }

    if (BEFORE_EVENTS.has(event) && results.some((result) => result === false)) {
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------ serialization

  /** Serialize the model to a plain object (attributes + loaded relations). */
  public toArray(): Record<string, unknown> {
    const modelClass = this.constructor as ModelClass;
    const out: Record<string, unknown> = {};
    for (const [name] of Object.entries(this._attributes)) {
      if (modelClass.hidden.includes(name)) continue;
      out[name] = this.serializeAttribute(name);
    }
    for (const [name, value] of Object.entries(this._relations)) {
      if (modelClass.hidden.includes(name)) continue;
      out[name] = serializeRelationValue(value);
    }
    return out;
  }

  public toJSON(): Record<string, unknown> {
    return this.toArray();
  }

  private serializeAttribute(name: string): unknown {
    const raw = this._attributes[name];
    const cast = (this.constructor as ModelClass).casts[name];
    if (raw instanceof Date) return raw.toISOString();
    if (!cast) return raw;
    // Apply the cast for output so serialized data matches getAttribute().
    const casted = this.castValue(name, raw);
    return casted instanceof Date ? casted.toISOString() : casted;
  }

  // ------------------------------------------------------------ factories

  /** Build a new unsaved instance (used by factories). */
  public static newInstance(attributes: Record<string, unknown> = {}): Model {
    return new this(attributes);
  }

  /** Create a model (used by factories) without mass-assignment filters. */
  public static async createRaw(attributes: Record<string, unknown>): Promise<Model> {
    const instance = new this();
    instance.forceFill(attributes);
    await instance.save();
    return instance;
  }
}

// --------------------------------------------------------------- helpers

const ACCESSOR_RE = /^get(.+)Attribute$/;

function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function pascalCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function pluralize(value: string): string {
  if (value.endsWith('y') && !'aeiou'.includes(value[value.length - 2])) return `${value.slice(0, -1)}ies`;
  if (value.endsWith('s') || value.endsWith('x') || value.endsWith('z') || value.endsWith('ch') || value.endsWith('sh')) {
    return `${value}es`;
  }
  return `${value}s`;
}

function serializeAttributes(attributes: Record<string, unknown>, casts: Record<string, CastType>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    out[name] = serializeValue(name, value, casts);
  }
  return out;
}

function serializeValue(name: string, value: unknown, casts: Record<string, CastType>): unknown {
  if (value instanceof Date) return value.toISOString();
  const cast = casts[name];
  switch (cast) {
    case 'int':
    case 'integer':
      return Number(value);
    case 'float':
    case 'double':
      return Number(value);
    case 'bool':
    case 'boolean':
      return value ? 1 : 0;
    case 'json':
    case 'array':
    case 'object':
      return typeof value === 'string' ? value : JSON.stringify(value);
    default:
      return value;
  }
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function serializeRelationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => (item instanceof Model ? item.toArray() : item));
  if (value instanceof Model) return value.toArray();
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return {
        ...record,
        data: record.data.map((item) => (item instanceof Model ? item.toArray() : item)),
      };
    }
  }
  return value;
}

/** Used by the router's model binding + `DB` facade for global type sanity. */
export function registerMorphClass(type: string, modelClass: ModelClass): void {
  morphMap.set(type, modelClass);
}

export function resolveMorphClass(type: string): ModelClass | undefined {
  return morphMap.get(type);
}
