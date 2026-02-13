import { useLocation } from 'react-router-dom';
import FileExplorer from '../components/FileExplorer/FileExplorer';
import Content from '../components/Workspace/Content';
import { BuildSteps } from '../components/BuildSteps';
import { useWebContainer } from '../hooks/useWebContainer';
import { useWorkspace } from '../hooks/useWorkspace';
import { handleDownload } from '../utility/helper';

export default function Workspace() {
  const location = useLocation();
  const { prompt } = location.state || { prompt: '' };
  const webContainer = useWebContainer();

  const {
    phase,
    files,
    steps,
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
    <div className="h-screen flex bg-gray-900">
      {/* Left Sidebar - Steps */}
      <div className="w-90 bg-gray-900 border-r border-gray-700 p-4 overflow-y-auto">
        <BuildSteps steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />
        <div className="mt-4">
          <input
            type="text"
            value={userPrompt}
            onChange={e => setUserPrompt(e.target.value)}
            placeholder="Enter your prompt"
            className="w-full p-2 rounded bg-gray-800 text-gray-100"
          />
          <button
            onClick={submitFollowUp}
            className="mt-2 w-full p-2 rounded bg-blue-600 text-gray-100"
            disabled={phase === 'building'}
          >
            {phase === 'building' ? 'Loading...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* File Explorer */}
      <div className="w-80 border-r border-gray-700">
        <FileExplorer files={files} onFileSelect={setSelectedFile} />
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <Content
          selectedFile={selectedFile}
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
