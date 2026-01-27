import { useState, useEffect, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';

interface UsePreviewOptions {
  webContainer: WebContainer | null;
  files: any[];
  autoStart?: boolean;
}

export function usePreview({ webContainer, files, autoStart = false }: UsePreviewOptions) {
  const [url, setUrl] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [shouldStart, setShouldStart] = useState(autoStart);
  const processRef = useRef<{ install: any; dev: any } | null>(null);
  const lastFilesHash = useRef<string>('');

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

  const startPreview = async () => {
    if (!webContainer || isStarting) return;
    
    setIsStarting(true);
    setUrl(""); // Reset URL while starting
    setShouldStart(false);

    try {
      // Clean up any existing processes
      if (processRef.current) {
        try {
          await processRef.current.install.kill();
          await processRef.current.dev.kill();
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Install dependencies
      const installProcess = await webContainer.spawn('npm', ['install']);
      processRef.current = { ...processRef.current, install: installProcess };

      installProcess.output.pipeTo(new WritableStream({
        write(data) {
          console.log('[Install]', data);
        }
      }));

      await installProcess.exit;

      // Start dev server
      const devProcess = await webContainer.spawn('npm', ['run', 'dev']);
      processRef.current = { ...processRef.current, dev: devProcess };

      devProcess.output.pipeTo(new WritableStream({
        write(data) {
          console.log('[Dev]', data);
        }
      }));

      // Wait for server-ready event
      webContainer.on('server-ready', (port, url) => {
        console.log("Server ready at:", url);
        setUrl(url);
      });

    } catch (error) {
      console.error('Failed to start preview:', error);
    } finally {
      setIsStarting(false);
    }
  };

  // Start preview when shouldStart becomes true
  useEffect(() => {
    if (shouldStart && webContainer) {
      startPreview();
    }
  }, [shouldStart, webContainer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processRef.current) {
        processRef.current.install?.kill();
        processRef.current.dev?.kill();
      }
    };
  }, []);

  return {
    url,
    isStarting,
    startPreview,
    shouldStart
  };
}