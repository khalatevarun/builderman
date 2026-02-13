import { FileItem, Step, StepType } from '../types';

/**
 * Flatten a nested FileItem tree into a flat array of { path, content } entries.
 * Only includes files (not folders).
 */
export function flattenFiles(
  fileItems: FileItem[],
  parentPath = ''
): Array<{ path: string; content: string }> {
  const result: Array<{ path: string; content: string }> = [];

  for (const item of fileItems) {
    const currentPath = parentPath ? `${parentPath}/${item.name}` : `/${item.name}`;

    if (item.type === 'file') {
      result.push({ path: currentPath, content: item.content || '' });
    } else if (item.type === 'folder' && item.children) {
      result.push(...flattenFiles(item.children, currentPath));
    }
  }

  return result;
}

/**
 * Build a WebContainer-compatible mount structure from a FileItem tree.
 */
export function createMountStructure(files: FileItem[]): Record<string, any> {
  const mountStructure: Record<string, any> = {};

  const processFile = (file: FileItem, isRootLevel: boolean): any => {
    if (file.type === 'folder') {
      const dirEntry = {
        directory: file.children
          ? Object.fromEntries(
              file.children.map(child => [child.name, processFile(child, false)])
            )
          : {},
      };
      if (isRootLevel) {
        mountStructure[file.name] = dirEntry;
      }
      return dirEntry;
    }

    // file.type === 'file'
    const fileEntry = { file: { contents: file.content || '' } };
    if (isRootLevel) {
      mountStructure[file.name] = fileEntry;
    }
    return fileEntry;
  };

  files.forEach(file => processFile(file, true));
  return mountStructure;
}

/**
 * Update a single file's content by path inside a nested FileItem tree.
 * Returns a new tree (immutable).
 */
export function updateFileByPath(
  nodes: FileItem[],
  targetPath: string,
  content: string,
  parentPath = ''
): FileItem[] {
  return nodes.map(node => {
    const currentPath = `${parentPath}/${node.name}`;

    if (node.type === 'file' && currentPath === targetPath) {
      return { ...node, content };
    }

    if (node.type === 'folder' && node.children) {
      return {
        ...node,
        children: updateFileByPath(node.children, targetPath, content, currentPath),
      };
    }

    return node;
  });
}

/**
 * Insert or update a single file inside a nested FileItem tree.
 * Fully immutable — returns a new tree, never mutates the input.
 */
function upsertFile(
  nodes: FileItem[],
  segments: string[],
  builtPath: string,
  content: string | undefined
): FileItem[] {
  if (segments.length === 0) return nodes;

  const [segmentName, ...rest] = segments;
  const currentPath = `${builtPath}/${segmentName}`;
  const isFile = rest.length === 0;

  if (isFile) {
    // Final segment — this is the file
    const idx = nodes.findIndex(x => x.path === currentPath);
    if (idx >= 0) {
      // File exists — replace with updated content (new object)
      return nodes.map((node, i) =>
        i === idx ? { ...node, content } : node
      );
    }
    // File doesn't exist — append a new entry
    return [
      ...nodes,
      { name: segmentName, type: 'file' as const, path: currentPath, content },
    ];
  }

  // Intermediate segment — this is a folder
  const idx = nodes.findIndex(x => x.path === currentPath);
  if (idx >= 0) {
    // Folder exists — recurse into a copy of its children
    return nodes.map((node, i) =>
      i === idx
        ? { ...node, children: upsertFile(node.children ?? [], rest, currentPath, content) }
        : node
    );
  }
  // Folder doesn't exist — create it, then recurse
  return [
    ...nodes,
    {
      name: segmentName,
      type: 'folder' as const,
      path: currentPath,
      children: upsertFile([], rest, currentPath, content),
    },
  ];
}

/**
 * Apply pending steps to an existing file tree.
 * Fully immutable — returns a new tree without mutating the input.
 */
export function applyStepsToFiles(
  currentFiles: FileItem[],
  steps: Step[]
): { files: FileItem[]; applied: boolean } {
  const pendingSteps = steps.filter(s => s.status === 'pending');
  if (pendingSteps.length === 0) return { files: currentFiles, applied: false };

  let result = currentFiles;
  let applied = false;

  for (const step of pendingSteps) {
    if (step.type !== StepType.CreateFile) continue;
    applied = true;
    const segments = step.path?.split('/').filter(Boolean) ?? [];
    result = upsertFile(result, segments, '', step.code);
  }

  return { files: result, applied };
}

/**
 * Compute which files changed between two flat file lists.
 * Returns only the files that are new or have different content.
 */
export function diffFiles(
  prevFiles: Array<{ path: string; content: string }>,
  currentFiles: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
  const prevMap = new Map(prevFiles.map(f => [f.path, f.content]));
  return currentFiles.filter(f => prevMap.get(f.path) !== f.content);
}

/**
 * Check if package.json content changed between two flat file lists.
 */
export function didPackageJsonChange(
  prevFiles: Array<{ path: string; content: string }>,
  currentFiles: Array<{ path: string; content: string }>
): boolean {
  const prev = prevFiles.find(f => f.path === '/package.json');
  const current = currentFiles.find(f => f.path === '/package.json');

  if (!prev && current) return true; // package.json was added
  if (prev && !current) return true; // package.json was removed
  if (!prev && !current) return false;

  return prev!.content !== current!.content;
}
