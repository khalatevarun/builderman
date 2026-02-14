import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FileItem, Step, Checkpoint } from '../types';
import { parseXml } from '../steps';
import {
  applyStepsToFiles,
  updateFileByPath,
  flattenFiles,
  buildFileTreeFromFlatList,
  contentHash,
} from '../utility/file-tree';
import { buildModificationsBlock } from '../utility/bolt-modifications';
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
  | { type: 'EDIT_FILE'; path: string; content: string }
  | {
      type: 'RESTORE_CHECKPOINT';
      files: FileItem[];
      steps: Step[];
      llmMessages: { role: 'user' | 'assistant'; content: string }[];
    };

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

    case 'RESTORE_CHECKPOINT': {
      return {
        ...state,
        files: action.files,
        steps: action.steps,
        llmMessages: action.llmMessages,
        phase: 'ready',
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

  /** Checkpoints (content-addressable). */
  checkpoints: Checkpoint[];
  restoreCheckpoint: (id: string) => void;

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
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const pendingSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Blob store for content-addressable checkpoints (hash → content)
  const blobStoreRef = useRef(new Map<string, string>());

  // Keep a ref to llmMessages so submitFollowUp always reads the latest value
  const llmMessagesRef = useRef(state.llmMessages);
  llmMessagesRef.current = state.llmMessages;

  // Files at last LLM response; used to build <bolt_file_modifications> when user edits before follow-up
  const filesAtLastLlmRef = useRef<Array<{ path: string; content: string }> | null>(null);

  /** Build a checkpoint from current files/steps/messages and push to blob store. */
  const createCheckpoint = useCallback(
    (
      files: FileItem[],
      steps: Step[],
      llmMessages: { role: 'user' | 'assistant'; content: string }[],
      label: string,
      version: number
    ): Checkpoint => {
      const flat = flattenFiles(files);
      const tree: Record<string, string> = {};
      const blob = blobStoreRef.current;
      for (const { path, content } of flat) {
        const hash = contentHash(content);
        if (!blob.has(hash)) blob.set(hash, content);
        tree[path] = hash;
      }
      return {
        id: uuidv4(),
        version,
        label,
        createdAt: Date.now(),
        tree,
        steps: [...steps],
        llmMessages: [...llmMessages],
      };
    },
    []
  );

  /** Restore state from a checkpoint (resolve tree via blob store). */
  const restoreCheckpoint = useCallback(
    (id: string) => {
      const cp = checkpoints.find(c => c.id === id);
      if (!cp) return;
      const blob = blobStoreRef.current;
      const flat = Object.entries(cp.tree).map(([path, hash]) => {
        const content = blob.get(hash);
        if (content === undefined) throw new Error(`Missing blob for hash ${hash}`);
        return { path, content };
      });
      const files = buildFileTreeFromFlatList(flat);
      dispatch({
        type: 'RESTORE_CHECKPOINT',
        files,
        steps: cp.steps,
        llmMessages: cp.llmMessages,
      });
      filesAtLastLlmRef.current = flat;
      setSelectedFile(null);
    },
    [checkpoints]
  );

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
      const xml = stepsResponse.data.response;
      const newSteps = parseXml(xml);
      const allMessages = [
        ...messagesPayload,
        { role: 'assistant' as const, content: xml },
      ];

      // Checkpoint = state after CODE_GENERATED. Compute from scratch (template + new steps).
      const templateSteps = parseXml(uiPrompts[0]);
      const { files: filesAfterTemplate } = applyStepsToFiles([], templateSteps);
      const { files: newFiles } = applyStepsToFiles(filesAfterTemplate, newSteps);
      const stepsAfterTemplate = templateSteps.map(s => ({ ...s, status: 'completed' as const }));
      const allSteps = [...stepsAfterTemplate, ...newSteps.map(s => ({ ...s, status: 'completed' as const }))];
      const cp = createCheckpoint(newFiles, allSteps, allMessages, initialPrompt, 1);
      setCheckpoints(prev => [...prev, cp]);

      dispatch({ type: 'CODE_GENERATED', xml, messages: allMessages });
      filesAtLastLlmRef.current = flattenFiles(newFiles);
    }

    init();
  }, [initialPrompt, createCheckpoint]);

  // ---- Follow-up prompt ----
  const submitFollowUp = useCallback(async () => {
    const currentFlat = flattenFiles(state.files);
    let content = userPrompt;
    if (filesAtLastLlmRef.current != null) {
      const block = buildModificationsBlock(filesAtLastLlmRef.current, currentFlat);
      if (block) content = `${block}\n\n${userPrompt}`;
    }
    const newMessage = { role: 'user' as const, content };
    const allMessages = [...llmMessagesRef.current, newMessage];
    const promptLabel = userPrompt;

    dispatch({ type: 'START_BUILDING' });

    const response = await getChatResponse(allMessages);
    const xml = response.data.response;
    const newSteps = parseXml(xml);
    const fullMessages = [
      ...allMessages,
      { role: 'assistant' as const, content: xml },
    ];

    // Checkpoint = state after this CODE_GENERATED (current files + new steps).
    const { files: newFiles } = applyStepsToFiles(state.files, newSteps);
    const newStepsWithStatus = newSteps.map(s => ({ ...s, status: 'completed' as const }));
    const allSteps = [...state.steps, ...newStepsWithStatus];
    const cp = createCheckpoint(newFiles, allSteps, fullMessages, promptLabel, checkpoints.length + 1);
    setCheckpoints(prev => [...prev, cp]);

    dispatch({ type: 'CODE_GENERATED', xml, messages: fullMessages });
    filesAtLastLlmRef.current = flattenFiles(newFiles);
    setUserPrompt('');
  }, [userPrompt, state.files, state.steps, checkpoints.length, createCheckpoint]);

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
  };
}
