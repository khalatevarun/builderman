import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BuildSteps } from './BuildSteps';
import type { Step } from '../types';

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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-gray-700 pt-3 mt-3">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-300 hover:text-gray-100 py-1"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        Build steps
      </button>
      {expanded && (
        <div className="mt-2">
          <BuildSteps steps={steps} currentStep={currentStep} onStepClick={onStepClick} showTitle={false} />
        </div>
      )}
    </div>
  );
}
