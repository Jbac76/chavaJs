import { QueryGrammar } from './QueryGrammar';

/** SQLite query grammar — the base behaviour (`?` placeholders, `"` quoting, RANDOM()). */
export class SQLiteQueryGrammar extends QueryGrammar {}
