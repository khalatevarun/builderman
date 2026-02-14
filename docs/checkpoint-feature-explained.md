# How the checkpoint feature works (with example)

## Data structures we use

### 1. Blob store (one per session)

- **What**: A `Map<string, string>` stored in a ref: `blobStoreRef.current`.
- **Keys**: Content hash (e.g. `"1a2b3c"`) — from `contentHash(fileContent)`.
- **Values**: The actual file content (string).

So: **hash → content**. Each unique file content is stored exactly once. If the same content appears in multiple checkpoints, they all point to the same hash; we don’t duplicate the string.

### 2. Checkpoint (one object per “save point”)

```ts
interface Checkpoint {
  id: string;           // e.g. "550e8400-e29b-41d4-a716-446655440000"
  version: number;      // 1, 2, 3, ...
  label: string;        // The user prompt that created this checkpoint
  createdAt: number;    // Date.now()
  tree: Record<string, string>;  // path → contentHash  (NOT the content itself)
  steps: Step[];        // Build steps at this point
  llmMessages: { role: 'user' | 'assistant'; content: string }[];  // Chat at this point
}
```

- **tree**: For each file path we only store the **hash** of its content. To get the content back, we look it up in the blob store. So a checkpoint is small: path → hash, plus steps and messages.

### 3. How is the hash calculated?

We use a **simple non-crypto hash** (djb2-style) in `contentHash(content)`:

```ts
function contentHash(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h) ^ content.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
```

- Start with a seed `5381`, then for each character: combine the current value with the character code using bitwise ops, then convert the final number to base-36 so we get a short string (e.g. `"1k2j3h"`).
- **Same content → same hash**, every time. Different content will almost always give a different hash (collisions are possible but very rare for normal file sizes).
- We don’t need cryptography here; we only need a stable fingerprint so we can deduplicate content in the blob store.

### 4. When the LLM responds: what do we get, and how do we use the blob store?

**What the LLM actually returns (from the system prompt):** The model is instructed to wrap its response in a `<boltArtifact>` that contains `<boltAction>` elements. For files it returns:

- `<boltAction type="file" filePath="src/App.tsx">` … **full file content** … `</boltAction>`

So we get **one or more file actions**, each with a path and the **complete content** of that file (the prompt says “Always provide the FULL, updated content” and “ALWAYS show the complete, up-to-date file contents”). We do **not** get a single “list of all files” from the API — we get an artifact that may contain several file actions (and shell actions), each with path + full content for that file.

**What we do with it:** The frontend parses that XML into **steps** (`parseXml` in `steps.ts`): each `<boltAction type="file" filePath="...">` becomes a step with `path` and `code` (the full content). We then **apply those steps** to the **current** file tree (reducer state) using `applyStepsToFiles`: for each step we create or update that path with that content. The result is the **new** full file tree in memory (all paths and contents as of that moment).

So the “list of all files” we use when creating a checkpoint is: **the file tree we have in state after applying the LLM’s file actions** — i.e. the full `FileItem[]` tree at that point. That tree can include both files the LLM just sent and files that were already there and unchanged (because `applyStepsToFiles` only creates/updates the paths mentioned in the steps; the rest of the tree stays from the previous state).

**Single pass over that tree:** When we create a checkpoint we do **one** pass:

1. **Flatten** the new file tree to a list of `{ path, content }` (every file in the project).
2. For **each** of those files:
   - Compute `hash = contentHash(content)`.
   - **If the blob store doesn’t have this hash**, add it: `blob.set(hash, content)`. So we only store content when we’re seeing this hash for the first time.
   - Record in the checkpoint’s tree: `tree[path] = hash`.

We are **not** doing a separate “compare with blob store” pass. The “comparison” is just the `if (!blob.has(hash))` check: if we’ve never seen this hash before, we add the content; otherwise we skip. So unchanged files (same content as in a previous checkpoint) will produce the same hash again, `blob.has(hash)` will be true, and we won’t duplicate. New or changed files will produce a new hash, we’ll add them once, and the checkpoint will point to that hash.

### 5. File tree (what you see in the app)

- **What**: Nested `FileItem[]`: folders have `children`, files have `content`.
- **Where**: In reducer state as `state.files`. This is what the editor, file explorer, and preview use.
- **Flattened form**: For checkpoint logic we often work with a flat list: `{ path: string, content: string }[]` (e.g. `/src/App.tsx` → content). We have `flattenFiles(files)` to get that, and `buildFileTreeFromFlatList(flat)` to go back to a nested tree.

---

## When do we create a checkpoint?

Only when the **LLM generates code** (a prompt is submitted and we get a response):

1. **First time**: After the initial template + first chat response (e.g. “build a todo app”). Label = **initial user prompt**. Version = 1.
2. **Every follow-up**: After each “Submit” that calls the chat API and we get new code. Label = **the prompt the user just typed**. Version = 2, 3, 4, …

We do **not** create a checkpoint when the user only edits a file in the editor.

---

## Example walkthrough

Assume:

- **Initial prompt**: “build a todo app”
- **Later prompt**: “add dark mode”

### Step 1: App loads, first LLM response

1. Template is loaded (boilerplate files).
2. Chat API is called with “build a todo app” and returns XML with steps (e.g. create `src/App.tsx`, `package.json`, etc.).
3. We apply those steps and get a **file tree**, e.g.:
   - `/package.json` → content A
   - `/src/App.tsx` → content B
   - `/src/main.tsx` → content C
4. **Create checkpoint 1**:
   - **Blob store** (before): empty.
   - For each file we compute `hash = contentHash(content)` and ensure the blob store has it:
     - `contentHash(A)` → e.g. `"h1"`, store `blob["h1"] = A`
     - `contentHash(B)` → e.g. `"h2"`, store `blob["h2"] = B`
     - `contentHash(C)` → e.g. `"h3"`, store `blob["h3"] = C`
   - **Checkpoint 1** is saved as:
     - `label: "build a todo app"`
     - `version: 1`
     - `tree: { "/package.json": "h1", "/src/App.tsx": "h2", "/src/main.tsx": "h3" }`
     - plus `steps` and `llmMessages` at that moment.

So after step 1:

- **Blob store**: `{ "h1" → A, "h2" → B, "h3" → C }`
- **Checkpoints**: `[ { id: "...", version: 1, label: "build a todo app", tree: { ... }, steps, llmMessages } ]`

### Step 2: User submits “add dark mode”

1. Chat API returns new steps (e.g. change `App.tsx`, add a theme file).
2. We apply those steps to the **current** file tree. So now we have, for example:
   - `/package.json` → still A (unchanged)
   - `/src/App.tsx` → new content B'
   - `/src/main.tsx` → still C (unchanged)
   - `/src/theme.ts` → new content D
3. **Create checkpoint 2**:
   - For each file:
     - `/package.json` → A → hash `"h1"`. Blob already has `"h1"`, so we don’t add again.
     - `/src/App.tsx` → B' → hash `"h4"`. New content → we add `blob["h4"] = B'`.
     - `/src/main.tsx` → C → hash `"h3"`. Already in blob.
     - `/src/theme.ts` → D → hash `"h5"`. We add `blob["h5"] = D`.
   - **Checkpoint 2** is saved as:
     - `label: "add dark mode"`
     - `version: 2`
     - `tree: { "/package.json": "h1", "/src/App.tsx": "h4", "/src/main.tsx": "h3", "/src/theme.ts": "h5" }`
     - plus its own `steps` and `llmMessages`.

So after step 2:

- **Blob store**: `{ "h1" → A, "h2" → B, "h3" → C, "h4" → B', "h5" → D }`.  
  We did **not** store A, B, C again; we only added B' and D.
- **Checkpoints**: two entries. Each checkpoint only holds path → hash (and steps/messages), not the full file contents.

### Step 3: User clicks “Restore” on checkpoint 1

1. We take **checkpoint 1** and read its `tree`:  
   `{ "/package.json": "h1", "/src/App.tsx": "h2", "/src/main.tsx": "h3" }`.
2. For each path we get the content from the **blob store**:
   - `/package.json` → `blob["h1"]` → A  
   - `/src/App.tsx` → `blob["h2"]` → B  
   - `/src/main.tsx` → `blob["h3"]` → C  
3. We now have a flat list: `[ { path: "/package.json", content: A }, ... ]`.
4. We call **`buildFileTreeFromFlatList`** on that list to get back the nested `FileItem[]` (the same shape as `state.files`).
5. We dispatch **`RESTORE_CHECKPOINT`** with:
   - that `files` tree,
   - checkpoint 1’s `steps`,
   - checkpoint 1’s `llmMessages`.
6. The reducer sets `state.files`, `state.steps`, and `state.llmMessages` to those values. The UI and preview now show the “build a todo app” version again (no dark mode, no `theme.ts`).

So the **data structures** involved are:

- **Blob store**: one map of hash → content for the whole session.
- **Checkpoint**: path → hash (tree), plus steps and messages; no file content stored inside the checkpoint.
- **File tree**: the nested `FileItem[]` we use everywhere in the app; we rebuild it from the flat path+content list when restoring.

That’s how we avoid storing the full codebase multiple times: we store each **unique** content once in the blob store and only store **hashes** in each checkpoint.
