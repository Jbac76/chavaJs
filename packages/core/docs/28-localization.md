# Localization

chavaJs provides a simple translation system through the `__()` and `trans()`
functions, ported from Laravel's localization API.

## Configuration

`config/lang.ts`:

```ts
export default {
  locale: Env.get("APP_LOCALE", "en"),
  fallback_locale: Env.get("APP_FALLBACK_LOCALE", "en"),
  paths: ["lang"],
};
```

## Translation Files

Create JSON files in the `lang/` directory at your project root:

```
lang/
├── en.json
├── es.json
└── fr.json
```

**`lang/en.json`:**

```json
{
  "welcome": "Welcome to :app!",
  "auth": {
    "failed": "These credentials do not match our records.",
    "throttle": "Too many login attempts. Please try again in :seconds seconds."
  },
  "items": {
    "one": "You have :count item",
    "other": "You have :count items"
  }
}
```

## Usage

### The `__()` function

```ts
import { __ } from "../src/localization/Translator";

// Simple translation
const welcome = await __("welcome"); // "Welcome to chavaJs!"

// With placeholders
const msg = await __("welcome", { app: "MyApp" }); // "Welcome to MyApp!"

// Dot-notated keys
const error = await __("auth.failed"); // "These credentials do not match our records."

// With a specific locale
const spanish = await __("welcome", { app: "MiApp" }, "es");
```

### The `trans()` function

`trans()` is an alias for `__()`:

```ts
import { trans } from "../src/localization/Translator";

const msg = await trans("auth.failed");
```

### Locale management

```ts
import { getLocale, setLocale, getFallbackLocale, setFallbackLocale } from "../src/localization/Translator";

// Get the current locale
getLocale(); // "en"

// Change the locale at runtime
setLocale("es");

// Get/set the fallback locale
getFallbackLocale(); // "en"
setFallbackLocale("fr");
```

## Placeholder Interpolation

Placeholders are prefixed with `:` in translation strings:

```json
{
  "greeting": "Hello, :name!",
  "items": "You have :count items in :category"
}
```

```ts
await __("greeting", { name: "John" }); // "Hello, John!"
await __("items", { count: 5, category: "books" }); // "You have 5 items in books"
```

## Fallback Behavior

If a key is not found in the requested locale, the translator falls back to
`fallback_locale` (default: `en`). If still not found, the key itself is
returned:

```ts
await __("nonexistent.key"); // "nonexistent.key"
```

## API Reference

| Function | Description |
|---|---|
| `__(key, replacements?, locale?)` | Translate a key with optional placeholders |
| `trans(key, replacements?, locale?)` | Alias for `__()` |
| `getLocale()` | Get the current locale |
| `setLocale(locale)` | Set the current locale |
| `getFallbackLocale()` | Get the fallback locale |
| `setFallbackLocale(locale)` | Set the fallback locale |
