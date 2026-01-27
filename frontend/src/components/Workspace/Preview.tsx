import { WebContainer } from '@webcontainer/api';
import { usePreview } from '../../hooks/usePreview';

interface PreviewProps {
  webContainer: WebContainer;
  files: any[]; // Pass files to track changes
  isActive: boolean; // Track if preview tab is active
}

export function Preview({ webContainer, files, isActive }: PreviewProps) {
  const { url, isStarting, startPreview } = usePreview({
    webContainer,
    files,
    autoStart: isActive
  });
  return (
    <div className="w-full h-full border-">
      {isStarting && !url && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="mb-2">Starting preview...</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      )}
      {!isStarting && !url && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="mb-2">Preview not available</p>
            <p className="text-sm text-gray-400">Files will be mounted when preview starts</p>
            <button 
              onClick={startPreview}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Start Preview
            </button>
          </div>
        </div>
      )}
      {url && <iframe width={"100%"} height={"100%"} src={url} />}
    </div>
  );
}