export class ColumnDefinition {
  public name: string;
  public type: string;
  public isNullable = false;
  public defaultValue: unknown = undefined;
  public hasDefault = false;
  public isUnsigned = false;
  public isPrimary = false;
  public isAutoincrement = false;
  public isUnique = false;
  public referencesColumn?: string;
  public referencesTable?: string;
  public check?: string[];
  public length?: number;
  public precision?: number;
  public scale?: number;

  public constructor(
    definition: { name: string; type: string } & Partial<Omit<ColumnDefinition, 'name' | 'type'>>,
    private readonly registerIndex?: (index: IndexDefinition) => void,
  ) {
    this.name = definition.name;
    this.type = definition.type;
    if (definition.isNullable !== undefined) this.isNullable = definition.isNullable;
    if (definition.defaultValue !== undefined) this.defaultValue = definition.defaultValue;
    if (definition.hasDefault !== undefined) this.hasDefault = definition.hasDefault;
    if (definition.isUnsigned !== undefined) this.isUnsigned = definition.isUnsigned;
    if (definition.isPrimary !== undefined) this.isPrimary = definition.isPrimary;
    if (definition.isAutoincrement !== undefined) this.isAutoincrement = definition.isAutoincrement;
    if (definition.isUnique !== undefined) this.isUnique = definition.isUnique;
    this.referencesColumn = definition.referencesColumn;
    this.referencesTable = definition.referencesTable;
    this.check = definition.check;
    this.length = definition.length;
    this.precision = definition.precision;
    this.scale = definition.scale;
  }

  // ------------------------------------------------------------- modifiers

  public nullable(): this {
    this.isNullable = true;
    return this;
  }

  public default(value: unknown): this {
    this.defaultValue = value;
    this.hasDefault = true;
    return this;
  }

  public unsigned(): this {
    this.isUnsigned = true;
    return this;
  }

  public primary(): this {
    this.isPrimary = true;
    return this;
  }

  public unique(name?: string): this {
    if (name) {
      // A named unique index (Laravel: ->unique('name')) — no inline constraint.
      if (this.registerIndex) this.registerIndex({ type: 'unique', columns: [this.name], name });
    } else {
      this.isUnique = true;
    }
    return this;
  }

  public index(name?: string): this {
    if (this.registerIndex) this.registerIndex({ type: 'index', columns: [this.name], name });
    return this;
  }

  /** Add a foreign key constraint for this column (Laravel: ->references()->on()). */
  public references(column: string): this {
    this.referencesColumn = column;
    return this;
  }

  public on(table: string): this {
    this.referencesTable = table;
    return this;
  }

  /** Shorthand: ->foreignId('user_id')->constrained('users') */
  public constrained(table?: string): this {
    const target = table ?? pluralizeSnake(this.name.replace(/_id$/, ''));
    this.referencesColumn = 'id';
    this.referencesTable = target;
    return this;
  }
}

export interface IndexDefinition {
  type: 'index' | 'unique' | 'primary';
  columns: string[];
  name?: string;
}

export interface ForeignKeyDefinition {
  columns: string[];
  references: string;
  on: string;
}

/**
 * Laravel's Blueprint — the fluent table definition passed to schema
 * callbacks:
 *
 *   Schema.create('users', (table) => {
 *     table.id();
 *     table.string('name');
 *     table.string('email').unique();
 *     table.timestamps();
 *   });
 */
export class Blueprint {
  public readonly table: string;
  public readonly columns: ColumnDefinition[] = [];
  public readonly indexes: IndexDefinition[] = [];
  public readonly foreignKeys: ForeignKeyDefinition[] = [];
  public altering = false;
  private lastColumnIndex = -1;

  public constructor(table: string) {
    this.table = table;
  }

  // ------------------------------------------------------------ column types

  public id(): ColumnDefinition {
    return this.bigIncrements('id');
  }

  public increments(name: string): ColumnDefinition {
    return this.add({ name, type: 'integer', isAutoincrement: true, isPrimary: true });
  }

  public bigIncrements(name: string): ColumnDefinition {
    return this.add({ name, type: 'bigInteger', isAutoincrement: true, isPrimary: true });
  }

  public string(name: string, length = 255): ColumnDefinition {
    return this.add({ name, type: 'string', length });
  }

  public text(name: string): ColumnDefinition {
    return this.add({ name, type: 'text' });
  }

  public integer(name: string): ColumnDefinition {
    return this.add({ name, type: 'integer' });
  }

  public tinyInteger(name: string): ColumnDefinition {
    return this.add({ name, type: 'integer' });
  }

  public bigInteger(name: string): ColumnDefinition {
    return this.add({ name, type: 'bigInteger' });
  }

  public float(name: string): ColumnDefinition {
    return this.add({ name, type: 'float' });
  }

  public double(name: string): ColumnDefinition {
    return this.add({ name, type: 'double' });
  }

  public decimal(name: string, total = 8, places = 2): ColumnDefinition {
    return this.add({ name, type: 'decimal', precision: total, scale: places });
  }

  public boolean(name: string): ColumnDefinition {
    return this.add({ name, type: 'boolean' });
  }

  public date(name: string): ColumnDefinition {
    return this.add({ name, type: 'date' });
  }

  public dateTime(name: string): ColumnDefinition {
    return this.add({ name, type: 'dateTime' });
  }

  public time(name: string): ColumnDefinition {
    return this.add({ name, type: 'time' });
  }

  /** Nullable timestamp column (Laravel: ->timestamp()). */
  public timestamp(name: string): ColumnDefinition {
    return this.add({ name, type: 'timestamp', isNullable: true });
  }

  public timestamps(): void {
    this.timestamp('created_at');
    this.timestamp('updated_at');
  }

  /** Nullable `deleted_at` column (Laravel: ->softDeletes()). */
  public softDeletes(column = 'deleted_at'): ColumnDefinition {
    return this.add({ name: column, type: 'timestamp', isNullable: true });
  }

  public rememberToken(): ColumnDefinition {
    return this.string('remember_token', 100).nullable();
  }

  public json(name: string): ColumnDefinition {
    return this.add({ name, type: 'json' });
  }

  public jsonb(name: string): ColumnDefinition {
    return this.add({ name, type: 'jsonb' });
  }

  public uuid(name: string): ColumnDefinition {
    return this.add({ name, type: 'uuid' });
  }

  public binary(name: string): ColumnDefinition {
    return this.add({ name, type: 'binary' });
  }

  public enum(name: string, values: string[]): ColumnDefinition {
    return this.add({ name, type: 'enum', check: values });
  }

  /** Unsigned integer column for foreign keys (Laravel: ->foreignId()). */
  public foreignId(name: string): ColumnDefinition {
    return this.add({ name, type: 'bigInteger', isUnsigned: true });
  }

  // ------------------------------------------------------ table-level builders

  public index(cols: string | string[], name?: string): void {
    this.indexes.push({ type: 'index', columns: toArray(cols), name });
  }

  public uniqueConstraint(cols: string | string[], name?: string): void {
    this.indexes.push({ type: 'unique', columns: toArray(cols), name });
  }

  public primaryConstraint(cols: string | string[], name?: string): void {
    this.indexes.push({ type: 'primary', columns: toArray(cols), name });
  }

  public foreign(cols: string | string[]): ForeignKeyBuilder {
    const columns = toArray(cols);
    const builder = new ForeignKeyBuilder(columns, (references, on) => {
      this.foreignKeys.push({ columns, references, on });
    });
    return builder;
  }

  // -------------------------------------------------------------- internals

  private add(definition: { name: string; type: string } & Partial<Omit<ColumnDefinition, 'name' | 'type'>>): ColumnDefinition {
    const column = new ColumnDefinition(definition, (index) => this.indexes.push(index));
    this.columns.push(column);
    this.lastColumnIndex = this.columns.length - 1;
    return column;
  }

  private last(): ColumnDefinition {
    if (this.lastColumnIndex < 0) {
      throw new Error('No column has been defined yet — call a column method first.');
    }
    return this.columns[this.lastColumnIndex];
  }
}

class ForeignKeyBuilder {
  private referenceColumn = '';

  public constructor(
    private readonly columns: string[],
    private readonly commit: (references: string, on: string) => void,
  ) {}

  public references(column: string): this {
    this.referenceColumn = column;
    return this;
  }

  public on(table: string): this {
    this.commit(this.referenceColumn, table);
    return this;
  }
}

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function pluralizeSnake(value: string): string {
  if (value.endsWith('y') && !'aeiou'.includes(value[value.length - 2])) return `${value.slice(0, -1)}ies`;
  if (value.endsWith('s') || value.endsWith('x') || value.endsWith('z') || value.endsWith('ch') || value.endsWith('sh')) {
    return `${value}es`;
  }
  return `${value}s`;
}
