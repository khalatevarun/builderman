import { useState } from 'react';
import { MoreVertical, RotateCcw } from 'lucide-react';
import type { Checkpoint } from '../types';

const MAX_LABEL_LEN = 45;

function truncate(label: string): string {
  if (label.length <= MAX_LABEL_LEN) return label;
  return label.slice(0, MAX_LABEL_LEN) + '…';
}

interface CheckpointListProps {
  checkpoints: Checkpoint[];
  onRestore: (id: string) => void;
}

export function CheckpointList({ checkpoints, onRestore }: CheckpointListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (checkpoints.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4 px-2">
        No checkpoints yet. Submit a prompt to create one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 px-2">
        Checkpoints
      </h2>
      {checkpoints.map((cp) => (
        <div
          key={cp.id}
          className="group rounded-lg border border-gray-700 bg-gray-800/80 hover:border-gray-600 transition-colors"
        >
          <div className="flex items-center gap-2 p-2 min-w-0">
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onRestore(cp.id)}
            >
              <span className="text-gray-300 text-sm block truncate" title={cp.label}>
                {truncate(cp.label)}
              </span>
              <span className="text-xs text-gray-500">v{cp.version}</span>
            </div>
            <div className="relative flex-shrink-0">
              <button
                type="button"
                className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === cp.id ? null : cp.id);
                }}
                aria-label="Options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {openMenuId === cp.id && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setOpenMenuId(null)}
                  />
                  <div className="absolute right-0 top-full mt-1 py-1 rounded-md bg-gray-800 border border-gray-700 shadow-lg z-20 min-w-[120px]">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                      onClick={() => {
                        onRestore(cp.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
