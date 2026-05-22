import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecentRoundSummaries,
} from './index';
import { getDialogueContext, resetDialogueContext, setDialogueContext } from './context';
import { deriveLastSystemAction, deriveNextExpectation } from './memory';
import { FALLBACK_DIALOGUE_PLAN, parseDialoguePlan } from './parser';
import type { DialoguePlannerMessage } from './types';

test('parseDialoguePlan parses valid JSON and respects search fields', () => {
  const raw = JSON.stringify({
    expectationMatch: 'matched',
    currentTopic: '失眠',
    topicStage: '延续中',
    replyPlan: '继续跟随，缩短输出。',
    topicStep: '先延续，再轻问。',
    responseMode: 'ask',
    shouldSearchMaterials: true,
    searchQuery: '夜间失眠具体场景',
    searchPurpose: '找可延续的话题素材',
  });

  const parsed = parseDialoguePlan(raw);
  assert.equal(parsed.expectationMatch, 'matched');
  assert.equal(parsed.responseMode, 'ask');
  assert.equal(parsed.shouldSearchMaterials, true);
  assert.equal(parsed.searchQuery, '夜间失眠具体场景');
  assert.equal(parsed.searchPurpose, '找可延续的话题素材');
});

test('parseDialoguePlan falls back on invalid search linkage', () => {
  const raw = JSON.stringify({
    expectationMatch: 'partially_matched',
    currentTopic: '失眠',
    topicStage: '转场中',
    replyPlan: '缩短输出。',
    topicStep: '慢慢换话题。',
    responseMode: 'default',
    shouldSearchMaterials: true,
    searchQuery: '',
    searchPurpose: '',
  });

  const parsed = parseDialoguePlan(raw);
  assert.equal(parsed.shouldSearchMaterials, false);
  assert.equal(parsed.searchQuery, '');
  assert.equal(parsed.searchPurpose, '');
});

test('parseDialoguePlan falls back on invalid JSON', () => {
  const parsed = parseDialoguePlan('not-json');
  assert.deepEqual(parsed, FALLBACK_DIALOGUE_PLAN);
});

test('buildRecentRoundSummaries collapses assistant bursts and keeps latest 6 rounds', () => {
  const messages: DialoguePlannerMessage[] = [
    { id: '1', role: 'user', content: '第一轮用户', timestamp: 1 },
    { id: '2', role: 'assistant', content: '第一轮助手1', timestamp: 2 },
    { id: '3', role: 'assistant', content: '第一轮助手2', timestamp: 3 },
    { id: '4', role: 'user', content: '第二轮用户', timestamp: 4 },
    { id: '5', role: 'assistant', content: '第二轮助手', timestamp: 5 },
    { id: '6', role: 'user', content: '第三轮用户', timestamp: 6 },
    { id: '7', role: 'assistant', content: '第三轮助手', timestamp: 7 },
    { id: '8', role: 'user', content: '第四轮用户', timestamp: 8 },
    { id: '9', role: 'assistant', content: '第四轮助手', timestamp: 9 },
    { id: '10', role: 'user', content: '第五轮用户', timestamp: 10 },
    { id: '11', role: 'assistant', content: '第五轮助手', timestamp: 11 },
    { id: '12', role: 'user', content: '第六轮用户', timestamp: 12 },
    { id: '13', role: 'assistant', content: '第六轮助手', timestamp: 13 },
    { id: '14', role: 'user', content: '第七轮用户', timestamp: 14 },
    { id: '15', role: 'assistant', content: '第七轮助手', timestamp: 15 },
    { id: '16', role: 'user', content: '待回复用户', timestamp: 16 },
  ];

  const summaries = buildRecentRoundSummaries(messages);

  assert.equal(summaries.length, 6);
  assert.equal(summaries[0]?.userSummary, '第二轮用户');
  assert.equal(summaries[0]?.assistantSummary, '第二轮助手');
  assert.equal(summaries[5]?.userSummary, '第七轮用户');
  assert.equal(summaries[5]?.assistantSummary, '第七轮助手');
  assert.match(summaries[0]?.roundSummary ?? '', /第二轮用户/);
});

test('dialogue context defaults to null and can be reset', () => {
  resetDialogueContext();
  assert.deepEqual(getDialogueContext(), {
    expectation: null,
    lastSystemAction: null,
  });

  setDialogueContext({
    expectation: {
      kind: 'share_more_detail',
      topicHint: '失眠',
      note: '继续讲昨晚的事',
    },
    lastSystemAction: 'ask',
  });

  assert.deepEqual(getDialogueContext(), {
    expectation: {
      kind: 'share_more_detail',
      topicHint: '失眠',
      note: '继续讲昨晚的事',
    },
    lastSystemAction: 'ask',
  });

  assert.deepEqual(resetDialogueContext(), {
    expectation: null,
    lastSystemAction: null,
  });
});

test('deriveNextExpectation and deriveLastSystemAction close the loop for ask mode', () => {
  const plan = {
    expectationMatch: 'matched' as const,
    currentTopic: '黑客松焦虑',
    topicStage: '延续中',
    replyPlan: '继续当前话题，用一个轻问题确认重点。',
    topicStep: '先延续焦虑话题，再轻问用户最担心哪一块。',
    responseMode: 'ask' as const,
    shouldSearchMaterials: false,
    searchQuery: '',
    searchPurpose: '',
  };

  const speech = {
    text: '最担心哪一块？',
    chunks: ['最担心哪一块？'],
    sendMode: 'single' as const,
    tone: 'steady' as const,
    rendererMode: 'render' as const,
  };

  assert.deepEqual(deriveNextExpectation(plan, speech), {
    kind: 'answer_current_question',
    topicHint: '黑客松焦虑',
    note: '先延续焦虑话题，再轻问用户最担心哪一块。',
  });

  assert.equal(deriveLastSystemAction(plan, speech), 'ask');
});
