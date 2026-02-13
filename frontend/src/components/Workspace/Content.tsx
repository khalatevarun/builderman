import { useState, useEffect } from 'react';
import type { WebContainer } from '@webcontainer/api';
import Tabs from './Tabs';
import CodeEditor from './CodeEditor';
import { Preview } from './Preview';
import type { FileItem } from '../../types';

interface ContentProps {
  webContainer: WebContainer | null;
  selectedFile: { name: string; content: string; path?: string } | null;
  onFileChange?: (content: string) => void;
  files: FileItem[];
  isBuildingApp: boolean;
}

export default function Content({
  selectedFile,
  webContainer,
  onFileChange,
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
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1">
        {activeTab === 'code' ? (
          <CodeEditor file={selectedFile} onChange={onFileChange} />
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
