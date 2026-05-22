import type {
  DialogueExpectation,
  LastSystemAction,
  TopicStimulusLevel,
} from './types';

interface TopicContextState {
  topicLabel: string;
  topicCategory: string;
  stimulusLevel: TopicStimulusLevel;
}

interface DialogueContextState {
  expectation: DialogueExpectation | null;
  lastSystemAction: LastSystemAction | null;
  topicContext: TopicContextState | null;
}

const state: DialogueContextState = {
  expectation: null,
  lastSystemAction: null,
  topicContext: null,
};

export function getDialogueContext(): DialogueContextState {
  return {
    expectation: state.expectation ? { ...state.expectation } : null,
    lastSystemAction: state.lastSystemAction,
    topicContext: state.topicContext ? { ...state.topicContext } : null,
  };
}

export function setDialogueContext(
  nextState: Partial<DialogueContextState>
): DialogueContextState {
  if (Object.prototype.hasOwnProperty.call(nextState, 'expectation')) {
    state.expectation = nextState.expectation
      ? { ...nextState.expectation }
      : null;
  }

  if (Object.prototype.hasOwnProperty.call(nextState, 'lastSystemAction')) {
    state.lastSystemAction = nextState.lastSystemAction ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(nextState, 'topicContext')) {
    state.topicContext = nextState.topicContext ? { ...nextState.topicContext } : null;
  }

  return getDialogueContext();
}

export function resetDialogueContext(): DialogueContextState {
  state.expectation = null;
  state.lastSystemAction = null;
  state.topicContext = null;
  return getDialogueContext();
}
