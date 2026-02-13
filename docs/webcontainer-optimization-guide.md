# WebContainer & usePreview Optimization Guide

## Table of Contents
1. [Understanding the Current Flow](#understanding-the-current-flow)
2. [Root Causes Explained](#root-causes-explained)
3. [Before/After Code Changes](#beforeafter-code-changes)
4. [Implementation Order](#implementation-order)

---

## Understanding the Current Flow

### Data Flow Diagram

```
Workspace (state: files, webcontainer)
    │
    ├── useEffect([files, webcontainer])  →  webcontainer.mount(mountStructure)   [Workspace.tsx L100-144]
    │
    └── Content
            └── Preview (props: webContainer, files, isActive)
                    └── usePreview({ webContainer, files, autoStart: isActive })
                            ├── useEffect([files, url])     →  if files changed && url set  →  setShouldStart(true)
                            └── useEffect([shouldStart, webContainer])  →  startPreview()
```

### What Happens Today

1. **User edits a file** in CodeEditor
2. After 500ms debounce, `onFileChange` fires → `setFiles(updated)` in Workspace
3. **Workspace effect runs**: `webcontainer.mount(fullTree)` - replaces entire filesystem
4. **usePreview effect runs**: detects `files` changed, sees `url` is set → `setShouldStart(true)`
5. **usePreview startPreview runs**: kills install/dev → `npm install` → `npm run dev` → wait for server-ready
6. **Result**: Every edit = full remount + full restart = **10-30+ seconds**

---

## Root Causes Explained

### Root Cause 1: Full Remount on Every `files` Change

**Location:** `frontend/src/pages/Workspace.tsx` (lines 100-144)

**What `mount()` does:**
- Replaces the **entire** WebContainer filesystem with a new tree
- **Deletes everything** that was there before (including `node_modules` from previous `npm install`)
- It's a "nuclear" operation - use sparingly

**Current Problem:**
- Runs on **every** `files` change (LLM adds files, user edits, etc.)
- Even if we didn't restart the dev server, we've already wiped `node_modules`
- Forces a full re-install on next preview start

**Solution:**
- Use `mount()` only for **initial project setup** or when **structure/dependencies change**
- For regular edits, use `webcontainer.fs.writeFile()` to update individual files

---

### Root Cause 2: Every File Change Triggers Full Preview Restart

**Location:** `frontend/src/hooks/usePreview.ts` (lines 17-27, 82-86)

**Current Logic:**
```typescript
// Effect A: Track file changes
useEffect(() => {
  const filesHash = JSON.stringify(files.map(f => ({ path: f.path, content: f.content })));
  if (lastFilesHash.current !== filesHash) {
    lastFilesHash.current = filesHash;
    if (url) {  // ← If preview is running
      setShouldStart(true);  // ← Restart everything!
    }
  }
}, [files, url]);
```

**Problem:**
- **Every** file change when preview is active → full restart
- Vite has HMR (Hot Module Replacement) - we don't need to restart!
- We just need to write the changed file to disk and let Vite handle it

**Solution:**
- Only restart when **dependencies change** (`package.json` modified)
- For content-only changes: use `fs.writeFile()` and let Vite HMR update the browser

---

### Root Cause 3: No Incremental File Sync

**Current State:**
- Only way to update WebContainer filesystem = `mount()` (full replacement)
- No use of `webcontainer.fs.writeFile()` or `fs.mkdir()`

**Problem:**
- Can't update a single file without replacing everything
- Forces full remount + restart cycle

**Solution:**
- Use `webcontainer.fs.writeFile(path, content)` for changed files
- Use `webcontainer.fs.mkdir(path, { recursive: true })` for new directories
- Keep dev server running, let Vite HMR handle updates

---

### Root Cause 4: Server-Ready Listener Accumulation

**Location:** `frontend/src/hooks/usePreview.ts` (line 69-73)

**Current Code:**
```typescript
webContainer.on('server-ready', (port, url) => {
  setUrl(url);
});
```

**Problem:**
- `startPreview()` called multiple times → multiple listeners added
- Never removed → all fire when server becomes ready
- Not the main performance issue, but causes bugs

**Solution:**
- WebContainer's `on(event, listener)` returns an `Unsubscribe` function. Call that function inside the listener after handling the event so the listener removes itself (one-time behaviour).
- Alternatively, register the listener once in a `useEffect` when `webContainer` is set and manage "starting" state with a ref.

---

## Before/After Code Changes

### Change 1: Fix Server-Ready Listener (Easiest - Start Here)

**File:** `frontend/src/hooks/usePreview.ts`

**Note:** WebContainer has no `once()` method. Its `on(event, listener)` returns an `Unsubscribe` function—call that inside the listener to remove it after the first fire (one-time behaviour).

#### Before:
```typescript
const startPreview = async () => {
  // ... existing code ...
  
  // Wait for server-ready event
  webContainer.on('server-ready', (port, url) => {
    console.log("Server ready at:", url);
    setUrl(url);
  });
};
```

#### After:
```typescript
const startPreview = async () => {
  // ... existing code ...
  
  // Wait for server-ready event; on() returns Unsubscribe - call it so listener runs only once
  const unsubscribe = webContainer.on('server-ready', (port, url) => {
    console.log("Server ready at:", url);
    setUrl(url);
    unsubscribe();  // Remove this listener so it doesn't accumulate on next startPreview()
  });
};
```

**Impact:** Prevents listener accumulation. Small fix, no behavior change otherwise.

---

### Change 2: Restart Only When Dependencies Change

**File:** `frontend/src/hooks/usePreview.ts`

#### Before:
```typescript
// Track file changes
useEffect(() => {
  const filesHash = JSON.stringify(files.map(f => ({ path: f.path, content: f.content })));
  
  if (lastFilesHash.current !== filesHash) {
    lastFilesHash.current = filesHash;
    // Files have changed, mark for restart if preview is active
    if (url) {
      setShouldStart(true);
    }
  }
}, [files, url]);
```

#### After:
```typescript
// Track file changes - only restart if dependencies changed
useEffect(() => {
  const filesHash = JSON.stringify(files.map(f => ({ path: f.path, content: f.content })));
  
  if (lastFilesHash.current !== filesHash) {
    const prevFiles = lastFilesHash.current ? JSON.parse(lastFilesHash.current) : [];
    const currentFiles = files.map(f => ({ path: f.path, content: f.content }));
    
    // Check if package.json or package-lock.json changed
    const prevPackageJson = prevFiles.find((f: any) => f.path === '/package.json' || f.path === 'package.json');
    const currentPackageJson = currentFiles.find((f: any) => f.path === '/package.json' || f.path === 'package.json');
    
    const depsChanged = 
      !prevPackageJson && currentPackageJson ||  // package.json was added
      prevPackageJson?.content !== currentPackageJson?.content;  // package.json content changed
    
    lastFilesHash.current = filesHash;
    
    // Only restart if dependencies changed (or first time)
    if (url && depsChanged) {
      setShouldStart(true);
    }
    // If deps didn't change but files did, we'll sync via fs.writeFile (Change 3)
  }
}, [files, url]);
```

**Impact:** Prevents unnecessary restarts. Only restarts when `package.json` changes (new dependencies).

---

### Change 3: Incremental File Sync with fs.writeFile

**File:** `frontend/src/hooks/usePreview.ts`

#### Before:
```typescript
// No incremental sync - only full mount/restart
```

#### After:
```typescript
// Add new function to sync changed files
const syncFilesToWebContainer = async (prevFiles: any[], currentFiles: any[]) => {
  if (!webContainer) return;
  
  // Find changed and new files
  const fileMap = new Map(currentFiles.map((f: any) => [f.path, f.content]));
  const prevFileMap = new Map(prevFiles.map((f: any) => [f.path, f.content]));
  
  for (const [path, content] of fileMap.entries()) {
    const prevContent = prevFileMap.get(path);
    
    // File is new or changed
    if (prevContent !== content) {
      try {
        // Normalize path (remove leading slash if present, or add it)
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        
        // Ensure parent directories exist
        const pathParts = normalizedPath.split('/').filter(Boolean);
        if (pathParts.length > 1) {
          const dirPath = '/' + pathParts.slice(0, -1).join('/');
          try {
            await webContainer.fs.mkdir(dirPath, { recursive: true });
          } catch (e) {
            // Directory might already exist, ignore
          }
        }
        
        // Write the file
        await webContainer.fs.writeFile(normalizedPath, content);
        console.log(`[Sync] Updated file: ${normalizedPath}`);
      } catch (error) {
        console.error(`[Sync] Failed to update ${path}:`, error);
      }
    }
  }
  
  // Handle deleted files (optional - can skip for now)
  // for (const path of prevFileMap.keys()) {
  //   if (!fileMap.has(path)) {
  //     await webContainer.fs.rm(path);
  //   }
  // }
};

// Update the file change effect to use incremental sync
useEffect(() => {
  const filesHash = JSON.stringify(files.map(f => ({ path: f.path, content: f.content })));
  
  if (lastFilesHash.current !== filesHash) {
    const prevFiles = lastFilesHash.current ? JSON.parse(lastFilesHash.current) : [];
    const currentFiles = files.map(f => ({ path: f.path, content: f.content }));
    
    // Check if package.json changed (from Change 2)
    const prevPackageJson = prevFiles.find((f: any) => f.path === '/package.json' || f.path === 'package.json');
    const currentPackageJson = currentFiles.find((f: any) => f.path === '/package.json' || f.path === 'package.json');
    
    const depsChanged = 
      !prevPackageJson && currentPackageJson ||
      prevPackageJson?.content !== currentPackageJson?.content;
    
    lastFilesHash.current = filesHash;
    
    if (url && depsChanged) {
      // Dependencies changed - full restart needed
      setShouldStart(true);
    } else if (url && !depsChanged) {
      // Only content changed - sync incrementally
      syncFilesToWebContainer(prevFiles, currentFiles);
    }
  }
}, [files, url, webContainer]);
```

**Impact:** Edits no longer trigger restarts. Files sync instantly, Vite HMR updates the browser.

---

### Change 4: Mount Only When Needed

**File:** `frontend/src/pages/Workspace.tsx`

#### Before:
```typescript
useEffect(() => {
  const createMountStructure = (files: FileItem[]): Record<string, any> => {
    // ... create mount structure ...
  };
  
  const mountStructure = createMountStructure(files);
  
  // Mount the structure if WebContainer is available
  console.log(mountStructure);
  webcontainer?.mount(mountStructure);
}, [files, webcontainer]);
```

#### After:
```typescript
// Add ref to track if we've mounted and what we mounted
const hasMountedRef = useRef(false);
const lastMountedHashRef = useRef<string>('');

useEffect(() => {
  if (!webcontainer) return;
  
  const createMountStructure = (files: FileItem[]): Record<string, any> => {
    // ... existing createMountStructure code ...
  };
  
  const filesHash = JSON.stringify(files.map(f => ({ path: f.path, content: f.content })));
  
  // Check if this is initial mount or structure changed
  const isInitialMount = !hasMountedRef.current;
  const structureChanged = lastMountedHashRef.current !== filesHash;
  
  // Only mount if:
  // 1. First time mounting (initial project setup)
  // 2. Structure/dependencies changed (new files, deleted files, package.json changed)
  if (isInitialMount || structureChanged) {
    const mountStructure = createMountStructure(files);
    console.log('[Mount] Mounting file structure:', mountStructure);
    
    webcontainer.mount(mountStructure).then(() => {
      hasMountedRef.current = true;
      lastMountedHashRef.current = filesHash;
      console.log('[Mount] Mount complete');
    }).catch((error) => {
      console.error('[Mount] Failed:', error);
    });
  } else {
    // Files changed but structure didn't - incremental sync handled by usePreview
    console.log('[Mount] Skipping mount - using incremental sync');
  }
}, [files, webcontainer]);
```

**Impact:** Mount runs only when necessary. Regular edits don't trigger remount.

---

## Implementation Order

Implement changes in this order for easiest testing:

### Step 1: Fix Server-Ready Listener ✅
- **File:** `usePreview.ts`
- **Change:** Store the `Unsubscribe` returned by `on('server-ready', ...)` and call it inside the listener so the listener removes itself after the first fire
- **Test:** Start preview, restart it a few times, check console for duplicate "Server ready" messages

### Step 2: Add Dependency Detection ✅
- **File:** `usePreview.ts`
- **Change:** Only set `shouldStart(true)` when `package.json` changes
- **Test:** Edit a source file → should NOT restart. Edit `package.json` → should restart

### Step 3: Add Incremental Sync ✅
- **File:** `usePreview.ts`
- **Change:** Add `syncFilesToWebContainer()` function and call it for non-dependency changes
- **Test:** Edit a file → check console for `[Sync] Updated file` → browser should update via HMR without restart

### Step 4: Fix Mount Logic ✅
- **File:** `Workspace.tsx`
- **Change:** Only mount on initial setup or structure changes
- **Test:** Edit files → check console for `[Mount] Skipping mount` → verify files still update correctly

---

## Expected Performance Improvements

### Before Optimization:
- **First preview:** ~15-30 seconds (mount + install + dev)
- **Every edit:** ~15-30 seconds (remount + restart + install + dev)
- **User experience:** Frustrating, feels broken

### After Optimization:
- **First preview:** ~15-30 seconds (mount + install + dev) - same
- **Every edit:** ~0.1-0.5 seconds (fs.writeFile + Vite HMR) - **30-300x faster**
- **Dependency change:** ~15-30 seconds (restart needed) - same, but rare
- **User experience:** Instant feedback, feels responsive

---

## Testing Checklist

After implementing each change:

- [ ] Preview starts correctly on first load
- [ ] Editing a source file updates the preview without restart
- [ ] Editing `package.json` triggers a restart (as expected)
- [ ] Adding a new file syncs correctly
- [ ] Console shows `[Sync] Updated file` messages for edits
- [ ] Console shows `[Mount] Skipping mount` for content-only changes
- [ ] No duplicate "Server ready" messages
- [ ] Preview iframe updates via Vite HMR (check browser network tab)

---

## Troubleshooting

### Files not updating in preview?
- Check console for `[Sync]` messages
- Verify file paths are correct (leading slash consistency)
- Check if Vite dev server is still running (`processRef.current.dev`)

### Mount happening too often?
- Check `hasMountedRef.current` and `lastMountedHashRef.current` values
- Verify `filesHash` calculation is consistent

### Restart happening when it shouldn't?
- Check `depsChanged` logic - make sure it's only true for `package.json` changes
- Verify `package.json` path matching (`/package.json` vs `package.json`)

---

## Additional Notes

### WebContainer File Paths
- WebContainer expects paths like `/src/App.tsx` (with leading slash)
- Your `FileItem.path` might be `/src/App.tsx` or `src/App.tsx`
- Normalize paths in `syncFilesToWebContainer()` to ensure consistency

### Vite HMR
- Vite automatically watches files in the WebContainer filesystem
- When you write a file with `fs.writeFile()`, Vite detects it and triggers HMR
- No need to manually notify Vite - it just works!

### Error Handling
- Wrap `fs.writeFile()` and `fs.mkdir()` in try-catch
- Log errors but don't crash - some errors are expected (e.g., directory already exists)
- Consider showing user-friendly error messages in the UI

---

## Next Steps After Implementation

1. **Monitor performance:** Add timing logs to measure actual improvement
2. **Handle edge cases:** Deleted files, renamed files, moved files
3. **Add UI feedback:** Show "Syncing..." indicator during incremental sync
4. **Optimize further:** Batch multiple file writes, debounce rapid edits
