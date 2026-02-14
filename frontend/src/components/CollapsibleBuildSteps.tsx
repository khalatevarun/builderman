import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BuildSteps } from './BuildSteps';
import type { Step } from '@/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface CollapsibleBuildStepsProps {
  steps: Step[];
  currentStep: string;
  onStepClick: (stepId: string) => void;
}

export function CollapsibleBuildSteps({
  steps,
  currentStep,
  onStepClick,
}: CollapsibleBuildStepsProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border pt-3 mt-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm font-semibold text-foreground hover:bg-accent/50 py-1 h-auto"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          Build steps
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">
          <BuildSteps steps={steps} currentStep={currentStep} onStepClick={onStepClick} showTitle={false} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
