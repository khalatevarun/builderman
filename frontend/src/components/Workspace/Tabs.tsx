import React from 'react';
import { Code2, Eye, FolderDown } from 'lucide-react';

interface TabsProps {
  activeTab: 'code' | 'preview';
  onTabChange: (tab: 'code' | 'preview') => void;
  onDownload?: () => void;
}

export default function Tabs({ activeTab, onTabChange, onDownload }: TabsProps) {
  return (
    <div className="flex items-center border-b border-gray-700">
      <button
        className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
          activeTab === 'code'
            ? 'text-blue-400 border-blue-400'
            : 'text-gray-400 border-transparent'
        } hover:text-blue-400`}
        onClick={() => onTabChange('code')}
      >
        <Code2 className="h-4 w-4" />
        Code
      </button>
      <button
        className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
          activeTab === 'preview'
            ? 'text-blue-400 border-blue-400'
            : 'text-gray-400 border-transparent'
        } hover:text-blue-400`}
        onClick={() => onTabChange('preview')}
      >
        <Eye className="h-4 w-4" />
        Preview
      </button>

      {onDownload && (
        <button
          onClick={onDownload}
          className="ml-auto mr-3 p-2 text-green-400 hover:text-green-300 rounded hover:bg-gray-700 transition-colors"
          title="Download project"
        >
          <FolderDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}