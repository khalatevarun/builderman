import { CheckCircle, Circle, Clock } from 'lucide-react';
import { Step } from '../types';

interface BuildStepsProps {
  steps: Step[];
  currentStep: string;
  onStepClick: (stepId: string) => void;
  /** When false, omit the "Build Steps" heading (e.g. when inside CollapsibleBuildSteps). */
  showTitle?: boolean;
}

export function BuildSteps({ steps, currentStep, onStepClick, showTitle = true }: BuildStepsProps) {
  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-4 h-full overflow-auto">
    {showTitle && (
    <h2 className="text-lg font-semibold mb-4 text-gray-100">Build Steps</h2>
    )}
    <div className="space-y-4">
      {steps.map((step) => (
        <div
          key={step.id}
          className={`p-1 rounded-lg cursor-pointer transition-colors flex items-center ${
            currentStep === step.id
              ? 'bg-gray-800 border border-gray-700'
              : 'bg-gray-700'
          }`}
          onClick={() => onStepClick(step.id)}
        >
          <div className="flex-shrink-0">
            {step.status === 'completed' ? (
              <CheckCircle className="text-green-500" />
            ) : step.status === 'in-progress' ? (
              <Clock className="text-yellow-500" />
            ) : (
              <Circle className="text-gray-500" />
            )}
          </div>
          <div className="ml-2 overflow-hidden flex-1">
            <span className="text-gray-100 text-sm">{step.title}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
}