import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { FileItem, Step } from '../types';
import { parseXml } from '../steps';
import { applyStepsToFiles, updateFileByPath } from '../utility/file-tree';
import { getChatResponse, getTemplate } from '../utility/api';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type WorkspacePhase = 'idle' | 'building' | 'ready';

export interface WorkspaceState {
  phase: WorkspacePhase;
  files: FileItem[];
  steps: Step[];
  llmMessages: { role: 'user' | 'assistant'; content: string }[];
}

const INITIAL_STATE: WorkspaceState = {
  phase: 'idle',
  files: [],
  steps: [],
  llmMessages: [],
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type WorkspaceAction =
  | { type: 'TEMPLATE_LOADED'; xml: string }
  | { type: 'START_BUILDING' }
  | {
      type: 'CODE_GENERATED';
      xml: string;
      messages: { role: 'user' | 'assistant'; content: string }[];
    }
  | { type: 'EDIT_FILE'; path: string; content: string };

// ---------------------------------------------------------------------------
// Reducer (pure & synchronous)
// ---------------------------------------------------------------------------

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'TEMPLATE_LOADED': {
      const newSteps = parseXml(action.xml);
      const { files } = applyStepsToFiles(state.files, newSteps);
      return {
        ...state,
        files,
        steps: [
          ...state.steps,
          ...newSteps.map(s => ({ ...s, status: 'completed' as const })),
        ],
        phase: 'building',
      };
    }

    case 'START_BUILDING': {
      return { ...state, phase: 'building' };
    }

    case 'CODE_GENERATED': {
      const newSteps = parseXml(action.xml);
      const { files } = applyStepsToFiles(state.files, newSteps);
      return {
        ...state,
        files,
        steps: [
          ...state.steps,
          ...newSteps.map(s => ({ ...s, status: 'completed' as const })),
        ],
        llmMessages: action.messages,
        phase: 'ready',
      };
    }

    case 'EDIT_FILE': {
      return {
        ...state,
        files: updateFileByPath(state.files, action.path, action.content),
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseWorkspaceReturn {
  /** Core state managed by the reducer. */
  phase: WorkspacePhase;
  files: FileItem[];
  steps: Step[];

  /** UI-local state. */
  selectedFile: { name: string; content: string; path?: string } | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<{ name: string; content: string; path?: string } | null>>;
  userPrompt: string;
  setUserPrompt: React.Dispatch<React.SetStateAction<string>>;
  currentStep: string;
  setCurrentStep: React.Dispatch<React.SetStateAction<string>>;

  /** Actions. */
  submitFollowUp: () => Promise<void>;
  editFile: (content: string) => void;
}

export function useWorkspace(initialPrompt: string): UseWorkspaceReturn {
  const [state, dispatch] = useReducer(workspaceReducer, INITIAL_STATE);

  // UI-only state (not part of the core reducer)
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string; path?: string } | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const pendingSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Keep a ref to llmMessages so submitFollowUp always reads the latest value
  const llmMessagesRef = useRef(state.llmMessages);
  llmMessagesRef.current = state.llmMessages;

  // ---- Init: fetch template, then chat ----
  useEffect(() => {
    async function init() {
      const response = await getTemplate(initialPrompt);
      const { prompts, uiPrompts } = response.data;

      // Atomically: apply boilerplate steps + phase → 'building'
      dispatch({ type: 'TEMPLATE_LOADED', xml: uiPrompts[0] });

      const messagesPayload = [...prompts, initialPrompt].map((content: string) => ({
        role: 'user' as const,
        content,
      }));

      const stepsResponse = await getChatResponse(messagesPayload);

      const allMessages = [
        ...messagesPayload,
        { role: 'assistant' as const, content: stepsResponse.data.response },
      ];

      // Atomically: apply LLM steps + save messages + phase → 'ready'
      dispatch({ type: 'CODE_GENERATED', xml: stepsResponse.data.response, messages: allMessages });
    }

    init();
  }, [initialPrompt]);

  // ---- Follow-up prompt ----
  const submitFollowUp = useCallback(async () => {
    const newMessage = { role: 'user' as const, content: userPrompt };
    const allMessages = [...llmMessagesRef.current, newMessage];

    dispatch({ type: 'START_BUILDING' });

    const response = await getChatResponse(allMessages);

    dispatch({
      type: 'CODE_GENERATED',
      xml: response.data.response,
      messages: [
        ...allMessages,
        { role: 'assistant' as const, content: response.data.response },
      ],
    });

    setUserPrompt('');
  }, [userPrompt]);

  // ---- File edit (debounced, used by code editor) ----
  const editFile = useCallback(
    (content: string) => {
      if (!selectedFile?.path) return;
      const targetPath = selectedFile.path;

      const existing = pendingSaveTimers.current[targetPath];
      if (existing) clearTimeout(existing);

      pendingSaveTimers.current[targetPath] = setTimeout(() => {
        dispatch({ type: 'EDIT_FILE', path: targetPath, content });
        setSelectedFile(f => (f ? { ...f, content } : f));
        delete pendingSaveTimers.current[targetPath];
      }, 500);
    },
    [selectedFile]
  );

  return {
    phase: state.phase,
    files: state.files,
    steps: state.steps,
    selectedFile,
    setSelectedFile,
    userPrompt,
    setUserPrompt,
    currentStep,
    setCurrentStep,
    submitFollowUp,
    editFile,
  };
}
