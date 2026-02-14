import { useState, useEffect } from 'react';
import type { WebContainer } from '@webcontainer/api';
import Tabs from './Tabs';
import CodeEditor from './CodeEditor';
import { Preview } from './Preview';
import FileExplorer from '@/components/FileExplorer/FileExplorer';
import type { FileItem } from '@/types';

interface ContentProps {
  webContainer: WebContainer | null;
  selectedFile: { name: string; content: string; path?: string } | null;
  onFileSelect: (file: { name: string; content: string; path: string }) => void;
  onFileChange?: (content: string) => void;
  onDownload?: () => void;
  files: FileItem[];
  isBuildingApp: boolean;
}

export default function Content({
  selectedFile,
  onFileSelect,
  webContainer,
  onFileChange,
  onDownload,
  files,
  isBuildingApp,
}: ContentProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

  // Switch to code tab when the user selects a file
  useEffect(() => {
    if (selectedFile) {
      setActiveTab('code');
    }
  }, [selectedFile]);

  return (
    <div className="h-full flex flex-col">
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} onDownload={onDownload} />
      <div className="flex-1 flex min-h-0">
        {activeTab === 'code' ? (
          <>
            <div className="w-64 border-r border-border flex-shrink-0 flex flex-col min-h-0 bg-card">
              <FileExplorer files={files} onFileSelect={onFileSelect} />
            </div>
            <div className="flex-1 min-w-0">
              <CodeEditor file={selectedFile} onChange={onFileChange} />
            </div>
          </>
        ) : (
          <Preview
            webContainer={webContainer}
            files={files}
            isBuildingApp={isBuildingApp}
          />
        )}
      </div>
    </div>
  );
}
