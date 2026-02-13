import type { WebContainer } from '@webcontainer/api';
import type { FileItem } from '../../types';
import { usePreviewManager, type PreviewStatus } from '../../hooks/usePreviewManager';

interface PreviewProps {
  webContainer: WebContainer | null;
  files: FileItem[];
  isBuildingApp: boolean;
}

/** Status message map for non-running states. */
const STATUS_DISPLAY: Record<Exclude<PreviewStatus, 'running'>, { title: string; subtitle?: string }> = {
  idle: { title: 'Preview not available', subtitle: 'Click below to start the preview' },
  building: { title: 'Building your app...', subtitle: 'Generating code with AI' },
  mounting: { title: 'Setting up project...', subtitle: 'Mounting files into the container' },
  installing: { title: 'Installing dependencies...', subtitle: 'Running npm install' },
  starting: { title: 'Starting dev server...', subtitle: 'Waiting for Vite to be ready' },
  error: { title: 'Something went wrong', subtitle: 'Check the console for details' },
};

export function Preview({ webContainer, files, isBuildingApp }: PreviewProps) {
  const { state, startManually } = usePreviewManager({
    webContainer,
    files,
    isBuildingApp,
  });

  // Preview is running — show iframe
  if (state.status === 'running' && state.url) {
    return (
      <div className="w-full h-full">
        <iframe width="100%" height="100%" src={state.url} />
      </div>
    );
  }

  // All other states — show status message
  const display = STATUS_DISPLAY[state.status as Exclude<PreviewStatus, 'running'>] ?? STATUS_DISPLAY.idle;
  const showSpinner = ['building', 'mounting', 'installing', 'starting'].includes(state.status);
  const showStartButton = state.status === 'idle' || state.status === 'error';

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <p className="mb-2">{state.error ?? display.title}</p>
        {display.subtitle && (
          <p className="text-sm text-gray-400 mb-4">{display.subtitle}</p>
        )}
        {showSpinner && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
        )}
        {showStartButton && (
          <button
            onClick={startManually}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {state.status === 'error' ? 'Retry' : 'Start Preview'}
          </button>
        )}
      </div>
    </div>
  );
}
