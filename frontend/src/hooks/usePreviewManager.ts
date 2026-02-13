import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { FileItem } from '../types';
import { flattenFiles, diffFiles, didPackageJsonChange } from '../utility/file-tree';
import {
  mountFileTree,
  syncChangedFiles,
  runInstall,
  runDevServer,
  onServerReady,
  waitForMount,
} from '../utility/webcontainer-service';

/** Preview lifecycle states. */
export type PreviewStatus = 'idle' | 'building' | 'mounting' | 'installing' | 'starting' | 'running' | 'error';

export interface PreviewManagerState {
  /** Current preview iframe URL (empty string when not running). */
  url: string;
  /** Current lifecycle status. */
  status: PreviewStatus;
  /** Error message if status is 'error'. */
  error?: string;
}

export interface UsePreviewManagerOptions {
  /** WebContainer instance (null while booting). */
  webContainer: WebContainer | null;
  /** Current file tree from Workspace state. */
  files: FileItem[];
  /** True while the Chat API is still processing (prevents auto-start). */
  isBuildingApp: boolean;
}

export interface UsePreviewManagerReturn {
  state: PreviewManagerState;
  /** Manually trigger a preview start (e.g. from a "Start Preview" button). */
  startManually: () => void;
}

export function usePreviewManager({
  webContainer,
  files,
  isBuildingApp,
}: UsePreviewManagerOptions): UsePreviewManagerReturn {
  // ---------- State ----------
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [error, setError] = useState<string | undefined>();

  // ---------- Refs ----------
  /** Tracks install and dev server processes so we can kill them on restart. */
  const processRef = useRef<{ install?: WebContainerProcess; dev?: WebContainerProcess }>({});
  /** Previous flattened files snapshot for diffing. */
  const prevFilesRef = useRef<Array<{ path: string; content: string }>>([]);
  /** Whether the initial mount + install + dev cycle has completed at least once. */
  const hasStartedOnce = useRef(false);
  /** Guard to prevent concurrent startPreview calls. */
  const isStartingRef = useRef(false);

  // ---------- Core: start preview (mount -> install -> dev) ----------
  const startPreview = useCallback(async () => {
    if (!webContainer || isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      // Kill existing processes
      try {
        processRef.current.install?.kill();
        processRef.current.dev?.kill();
      } catch (_e) { /* ignore */ }
      processRef.current = {};

      // Mount full file tree (only on first start; restarts rely on fs.writeFile)
      if (!hasStartedOnce.current) {
        setStatus('mounting');
        await mountFileTree(webContainer, files);

        const mounted = await waitForMount(webContainer);
        if (!mounted) {
          console.warn('[PreviewManager] Mount may not have completed');
        }
      }

      // Install dependencies
      setStatus('installing');
      setUrl('');
      setError(undefined);

      const installProcess = await runInstall(webContainer);
      processRef.current.install = installProcess;
      await installProcess.exit;

      // Start dev server
      setStatus('starting');
      const devProcess = await runDevServer(webContainer);
      processRef.current.dev = devProcess;

      // Wait for server-ready
      onServerReady(webContainer, (readyUrl) => {
        setUrl(readyUrl);
        setStatus('running');
        hasStartedOnce.current = true;
        // Snapshot files after successful start
        prevFilesRef.current = flattenFiles(files);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start preview';
      console.error('[PreviewManager]', message);
      setError(message);
      setStatus('error');
    } finally {
      isStartingRef.current = false;
    }
  }, [webContainer, files]);

  // ---------- Effect: react to file changes ----------
  useEffect(() => {
    if (!webContainer) return;

    const currentFlat = flattenFiles(files);
    const prevFlat = prevFilesRef.current;

    // Nothing to compare yet or no files
    if (currentFlat.length === 0) return;

    const hasPackageJson = currentFlat.some(f => f.path === '/package.json');

    // Case 1: Preview has never started
    if (!hasStartedOnce.current) {
      // Don't auto-start while LLM is still generating code
      if (isBuildingApp) {
        setStatus('building');
        return;
      }

      // We have files and package.json — time to start
      if (hasPackageJson && !isStartingRef.current) {
        startPreview();
      }
      return;
    }

    // Case 2: Preview is running — decide between restart and sync
    const changed = diffFiles(prevFlat, currentFlat);
    if (changed.length === 0) return; // Nothing changed

    const packageJsonChanged = didPackageJsonChange(prevFlat, currentFlat);

    if (packageJsonChanged) {
      // package.json changed → write ALL changed files, then restart install + dev
      console.log('[PreviewManager] package.json changed, restarting...');
      syncChangedFiles(webContainer, changed)
        .then(() => startPreview())
        .catch(err => console.error('[PreviewManager] Sync before restart failed:', err));
    } else {
      // Only source files changed → write them, Vite HMR handles the rest
      console.log('[PreviewManager] Syncing files...', changed.map(f => f.path));
      syncChangedFiles(webContainer, changed)
        .then(() => {
          prevFilesRef.current = currentFlat;
        })
        .catch(err => console.error('[PreviewManager] Sync failed:', err));
    }
  }, [webContainer, files, isBuildingApp, startPreview]);

  // ---------- Effect: update status when isBuildingApp changes ----------
  useEffect(() => {
    if (isBuildingApp && !hasStartedOnce.current) {
      setStatus('building');
    }
  }, [isBuildingApp]);

  // ---------- Cleanup on unmount ----------
  useEffect(() => {
    return () => {
      try {
        processRef.current.install?.kill();
        processRef.current.dev?.kill();
      } catch (_e) { /* ignore */ }
    };
  }, []);

  // ---------- Manual start handler ----------
  const startManually = useCallback(() => {
    if (!isStartingRef.current) {
      startPreview();
    }
  }, [startPreview]);

  return {
    state: { url, status, error },
    startManually,
  };
}
