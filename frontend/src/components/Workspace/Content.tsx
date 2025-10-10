import { useState } from 'react';
import Tabs from './Tabs';
import CodeEditor from './CodeEditor';
import { WebContainer } from '@webcontainer/api';
import { Preview } from './Preview';

interface ContentProps {
  webContainer: WebContainer
  selectedFile: { name: string; content: string; path?: string } | null;
  onFileChange?: (content: string) => void;
}

export default function Content({ selectedFile, webContainer, onFileChange }: ContentProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

  return (
    <div className="h-full flex flex-col">
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1">
        {activeTab === 'code' ? (
          <CodeEditor file={selectedFile} onChange={onFileChange} />
        ) : (
          <Preview webContainer={webContainer} />
        )}
      </div>
    </div>
  );
}