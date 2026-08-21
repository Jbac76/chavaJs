# File Storage

chavaJs provides a unified filesystem API through the `Storage` facade,
mirroring Laravel's `Illuminate\Support\Facades\Storage`. Store files locally
with the option to add S3 or other drivers later.

## Configuration

`config/filesystem.ts` defines the default disk and named disk configurations:

```ts
export default {
  default: Env.get("FILESYSTEM_DISK", "local"),
  disks: {
    local: {
      driver: "local",
      root: Env.get("STORAGE_PATH", "storage/app"),
      visibility: "public",
    },
  },
};
```

## Usage

```ts
import { Storage } from "../src/facades";

// Get the default disk
const disk = Storage.disk();

// Or use a named disk
const local = Storage.disk("local");
```

### Reading files

```ts
// Get file contents as string
const content = await disk.get("file.txt");

// Get file contents as Buffer
const buffer = await disk.getBuffer("image.png");
```

### Writing files

```ts
// Write a string
await disk.put("file.txt", "Hello, world!");

// Write a Buffer
await disk.put("image.png", imageBuffer);

// Write with visibility
await disk.put("public-file.txt", "visible", { visibility: "public" });
```

### Checking existence

```ts
if (await disk.exists("file.txt")) {
  // file exists
}
```

### Deleting files

```ts
await disk.delete("file.txt"); // returns true on success
```

### File metadata

```ts
const stats = await disk.stat("file.txt");
// { size: 1234, lastModified: Date, isFile: true, isDirectory: false }
```

### Listing files

```ts
// List files in a directory
const files = await disk.files("uploads");

// List all files recursively
const allFiles = await disk.allFiles("uploads");
```

### Listing disks

```ts
const diskNames = Storage.getDisks(); // ["local"]
```

### Copying and moving

```ts
await disk.copy("from.txt", "to.txt");
await disk.move("old.txt", "new.txt");
```

### Directories

```ts
await disk.makeDirectory("uploads/images");
await disk.deleteDirectory("uploads/old");
```

### URLs

```ts
disk.url("file.txt"); // "/storage/file.txt"
disk.path("file.txt"); // "/absolute/path/to/storage/app/file.txt"
```

## API Reference

| Method | Returns | Description |
|---|---|---|
| `get(path)` | `Promise<string>` | Read file as string |
| `getBuffer(path)` | `Promise<Buffer>` | Read file as Buffer |
| `put(path, content, options?)` | `Promise<void>` | Write file |
| `exists(path)` | `Promise<boolean>` | Check if file exists |
| `delete(path)` | `Promise<boolean>` | Delete a file |
| `stat(path)` | `Promise<FileStats>` | Get file metadata |
| `makeDirectory(path)` | `Promise<void>` | Create directory recursively |
| `deleteDirectory(path)` | `Promise<void>` | Delete directory recursively |
| `files(directory?)` | `Promise<string[]>` | List files in directory |
| `allFiles(directory?)` | `Promise<string[]>` | List all files recursively |
| `copy(from, to)` | `Promise<void>` | Copy a file |
| `move(from, to)` | `Promise<void>` | Move/rename a file |
| `url(path)` | `string` | Get public URL |
| `path(path)` | `string` | Get absolute path |
| `getName()` | `string` | Get disk name |

## Available Disks

| Driver | Description |
|---|---|
| `local` | Local filesystem (default) |
| `s3` | Amazon S3 (requires `npm i @aws-sdk/client-s3`) |
