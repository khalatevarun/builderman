import { CheckCircle, Circle, Clock } from 'lucide-react';
import type { Step } from '@/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BuildStepsProps {
  steps: Step[];
  currentStep: string;
  onStepClick: (stepId: string) => void;
  showTitle?: boolean;
}

export function BuildSteps({ steps, currentStep, onStepClick, showTitle = true }: BuildStepsProps) {
  return (
    <Card className="rounded-lg border border-border bg-card p-4 overflow-auto">
      {showTitle && (
        <h2 className="text-sm font-semibold text-foreground mb-4">Build Steps</h2>
      )}
      <div className="space-y-2">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors',
              currentStep === step.id
                ? 'bg-accent border border-border'
                : 'bg-muted/50 hover:bg-muted'
            )}
            onClick={() => onStepClick(step.id)}
          >
            <span className="shrink-0">
              {step.status === 'completed' ? (
                <CheckCircle className="h-4 w-4 text-primary" />
              ) : step.status === 'in-progress' ? (
                <Clock className="h-4 w-4 text-amber-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="text-sm text-foreground truncate">{step.title}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
