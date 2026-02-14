import { MoreVertical, RotateCcw } from 'lucide-react';
import type { Checkpoint } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';

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
  if (checkpoints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 px-2">
        No checkpoints yet. Submit a prompt to create one.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
        Checkpoints
      </h2>
      {checkpoints.map((cp) => (
        <Card
          key={cp.id}
          className="group rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2 p-2 min-w-0">
            <button
              type="button"
              className="flex-1 min-w-0 text-left cursor-pointer"
              onClick={() => onRestore(cp.id)}
            >
              <span className="text-sm font-medium text-foreground block truncate" title={cp.label}>
                {truncate(cp.label)}
              </span>
              <span className="text-xs text-muted-foreground">v{cp.version}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onRestore(cp.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Restore
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      ))}
    </div>
  );
}
