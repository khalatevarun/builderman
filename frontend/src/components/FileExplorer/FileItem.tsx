import React from 'react';
import { ChevronRight, ChevronDown, FileCode, FolderIcon } from 'lucide-react';

interface FileItemProps {
  name: string;
  type: 'file' | 'folder';
  level: number;
  isOpen?: boolean;
  content?: string;
  onToggle: () => void;
  onSelect: () => void;
}

export default function FileItem({
  name,
  type,
  level,
  isOpen,
  onToggle,
  onSelect
}: FileItemProps) {
  return (
    <div
      className="flex items-center gap-1 py-1 px-2 hover:bg-accent rounded-md cursor-pointer text-foreground text-sm"
      style={{ paddingLeft: `${level * 1.5}rem` }}
      onClick={type === 'folder' ? onToggle : onSelect}
    >
      {type === 'folder' && (
        <span className="p-0.5 shrink-0">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      )}
      {type === 'folder' ? (
        <FolderIcon className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{name}</span>
    </div>
  );
}