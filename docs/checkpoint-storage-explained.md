# How content-addressable checkpoint storage works

## The problem with full snapshots

If we store the **entire file tree** at every checkpoint:

- Checkpoint 1: 20 files → store 20 file contents  
- Checkpoint 2: 20 files, but only 2 changed → we’d still store all 20 again (18 duplicated)  
- Checkpoint 3: 20 files, 1 changed → again 20 stored (19 duplicated)

So storage grows as **checkpoints × files**. Most of that is duplicate content.

---

## Idea: store each content once, reference by hash

**Content-addressable** means: we identify content by a **hash** (e.g. a short fingerprint of the string). Same content ⇒ same hash ⇒ stored once.

1. **Blob store** (one map for the whole session):  
   `hash(content) → content`  
   So each **unique** file content exists only once in this map.

2. **Each checkpoint** does **not** store file contents. It only stores a **tree**:  
   `path → hash`  
   So we only record “at this path we have the content with this hash”.

3. **Creating a checkpoint** (after each prompt):
   - Take current `files` and flatten to a list of `{ path, content }`.
   - For each file:
     - Compute `h = hash(content)`.
     - If `h` is not in the blob store, add `blobStore[h] = content`.
     - Add `tree[path] = h`.
   - Save the checkpoint as: `{ id, version, label, tree, steps, llmMessages }` (and optionally a ref to the blob store, or the blob store is global for the session).

4. **Restoring a checkpoint**:
   - Read the checkpoint’s `tree` (path → hash).
   - For each path, get `content = blobStore[hash]`.
   - Rebuild the `FileItem[]` tree from the list of `{ path, content }` (we need a small helper that builds the nested tree from a flat path list).
   - Set state to that `files` plus the checkpoint’s `steps` and `llmMessages`.

So we only **add to the blob store when content is new**. If 10 checkpoints all have the same `package.json`, that content is stored once and referenced 10 times by its hash. Only **changed** files create new blob entries. Storage grows with **unique content**, not with number of checkpoints.

---

## In-memory implementation (no backend)

- **Blob store**: `Map<string, string>` (hash → content). Lives in the same place as checkpoints (e.g. in useWorkspace, or in a ref that outlives reducer state).
- **Hash function**: For in-memory we can use something simple and fast, e.g.:
  - A short hash of the string (e.g. 32-bit numeric hash turned into a string), or
  - `hash = content.length + '-' + simpleHash(content)` to reduce collisions.
  - No need for cryptographic strength; we only need consistency and low collision chance.
- **Checkpoint shape**:  
  `{ id, version, label, createdAt, tree: Record<path, hash>, steps, llmMessages }`  
  and we keep one `Map<hash, content>` for the whole session.
- **Save**: Flatten current files → for each path/content, hash and ensure blob store has it, build `tree` → push checkpoint with that tree.
- **Load**: From checkpoint’s `tree`, resolve each path to content via blob store, then build `FileItem[]` from the flat list (new small utility: e.g. `buildFileTreeFromFlatList(flat: { path, content }[])`).

---

## Why “only the changed files” are stored

We don’t literally store “only the changed files” in the checkpoint. We store:

- **In the blob store**: every **unique** content that has ever appeared (so the first time a file content appears, it’s added; if the same content appears again in another checkpoint, we reuse the same hash and don’t add again).
- **In the checkpoint**: for **every** path, the **hash** of its content at that time (so the checkpoint is small: path → hash, no big strings).

So at each point in time we only “add” new content for files that **changed** (new or different content). Unchanged files across checkpoints share the same hash and therefore the same blob entry. That’s the optimization.
