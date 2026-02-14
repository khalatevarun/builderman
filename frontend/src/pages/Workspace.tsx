import { useLocation } from 'react-router-dom';
import Content from '@/components/Workspace/Content';
import { CheckpointList } from '@/components/CheckpointList';
import { CollapsibleBuildSteps } from '@/components/CollapsibleBuildSteps';
import { useWebContainer } from '@/hooks/useWebContainer';
import { useWorkspace } from '@/hooks/useWorkspace';
import { handleDownload } from '@/utility/helper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Workspace() {
  const location = useLocation();
  const { prompt } = location.state || { prompt: '' };
  const webContainer = useWebContainer();

  const {
    phase,
    files,
    steps,
    checkpoints,
    restoreCheckpoint,
    selectedFile,
    setSelectedFile,
    userPrompt,
    setUserPrompt,
    currentStep,
    setCurrentStep,
    submitFollowUp,
    editFile,
  } = useWorkspace(prompt);

  return (
    <div className="h-screen flex bg-background text-foreground dark">
      {/* Left Sidebar - Checkpoints + collapsible Build steps */}
      <div className="w-80 border-r border-border bg-card p-4 overflow-y-auto flex flex-col gap-4">
        <CheckpointList checkpoints={checkpoints} onRestore={restoreCheckpoint} />
        <CollapsibleBuildSteps
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
        <div className="mt-auto flex-shrink-0 space-y-2">
          <Input
            type="text"
            value={userPrompt}
            onChange={e => setUserPrompt(e.target.value)}
            placeholder="Enter your prompt"
            className="h-9"
          />
          <Button
            onClick={submitFollowUp}
            className="w-full"
            disabled={phase === 'building'}
          >
            {phase === 'building' ? 'Loading...' : 'Submit'}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <Content
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          webContainer={webContainer}
          files={files}
          isBuildingApp={phase !== 'ready'}
          onFileChange={editFile}
          onDownload={() => handleDownload(files)}
        />
      </div>
    </div>
  );
}
