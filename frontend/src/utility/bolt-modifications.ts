import { diffFiles } from './file-tree';

const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';
const WORK_DIR = '/home/project';

function fullPath(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${WORK_DIR}/${normalized}`;
}

/**
 * Build a <bolt_file_modifications> block containing <file path="...">content</file>
 * for each file that changed between prevFiles and currentFiles. Full content only (no diffs).
 */
export function buildModificationsBlock(
  prevFiles: Array<{ path: string; content: string }>,
  currentFiles: Array<{ path: string; content: string }>
): string {
  const changed = diffFiles(prevFiles, currentFiles);
  if (changed.length === 0) return '';

  const parts = changed.map(
    ({ path, content }) => `<file path="${fullPath(path)}">\n${content}</file>`
  );
  return `<${MODIFICATIONS_TAG_NAME}>\n${parts.join('\n')}\n</${MODIFICATIONS_TAG_NAME}>`;
}
