import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { FileItem } from '../types';
import { createMountStructure } from './file-tree';

/**
 * Mount the full file tree into the WebContainer.
 * Used ONCE on initial start only.
 */
export async function mountFileTree(
  webContainer: WebContainer,
  files: FileItem[]
): Promise<void> {
  const structure = createMountStructure(files);
  await webContainer.mount(structure);
}

/**
 * Write only the changed files into the WebContainer using webContainer.fs.writeFile.
 * Creates parent directories if needed. Used for ALL updates after initial mount.
 */
export async function syncChangedFiles(
  webContainer: WebContainer,
  changedFiles: Array<{ path: string; content: string }>
): Promise<void> {
  for (const { path, content } of changedFiles) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Ensure parent directories exist
    const parts = normalizedPath.split('/').filter(Boolean);
    if (parts.length > 1) {
      const dirPath = '/' + parts.slice(0, -1).join('/');
      try {
        await webContainer.fs.mkdir(dirPath, { recursive: true });
      } catch (_e) {
        // Directory likely already exists
      }
    }

    await webContainer.fs.writeFile(normalizedPath, content);
  }
}

/**
 * Run `npm install` inside the WebContainer.
 * Pipes output to console. Resolves when install completes.
 */
export async function runInstall(
  webContainer: WebContainer
): Promise<WebContainerProcess> {
  const process = await webContainer.spawn('npm', ['install']);

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        console.log('[Install]', data);
      },
    })
  );

  return process;
}

/**
 * Run `npm run dev` inside the WebContainer.
 * Pipes output to console. Does NOT wait for exit (dev server runs indefinitely).
 */
export async function runDevServer(
  webContainer: WebContainer
): Promise<WebContainerProcess> {
  const process = await webContainer.spawn('npm', ['run', 'dev']);

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        console.log('[Dev]', data);
      },
    })
  );

  return process;
}

/**
 * Subscribe to the server-ready event.
 * Returns an unsubscribe function. Automatically unsubscribes after the first event.
 */
export function onServerReady(
  webContainer: WebContainer,
  onReady: (url: string) => void
): () => void {
  const unsubscribe = webContainer.on('server-ready', (_port, url) => {
    onReady(url);
    unsubscribe();
  });
  return unsubscribe;
}

/**
 * Wait until package.json is readable inside the WebContainer.
 * Used to confirm that mount() has completed before running npm install.
 */
export async function waitForMount(
  webContainer: WebContainer,
  maxRetries = 15,
  intervalMs = 300
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await webContainer.fs.readFile('/package.json', 'utf-8');
      return true;
    } catch (_e) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}
