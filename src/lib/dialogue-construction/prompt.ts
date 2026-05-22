import type {
  DialogueConstructionInput,
  DialogueExpectation,
  DialogueRoundSummary,
} from './types';

export const DIALOGUE_CONSTRUCTION_SYSTEM_PROMPT =
  '你是 dialogue construction planner。只输出JSON。你只做对话决策，不写最终台词，不安慰，不执行搜索，不写记忆。';

function formatExpectation(expectation: DialogueExpectation | null): string {
  if (!expectation) {
    return '(无上一轮预期，本轮 expectationMatch 必须为 "none")';
  }

  return `kind=${expectation.kind} | topicHint=${expectation.topicHint || '(空)'} | note=${expectation.note || '(空)'}`;
}

function formatRoundSummaries(rounds: DialogueRoundSummary[]): string {
  if (rounds.length === 0) {
    return '(无已完成轮次)';
  }

  return rounds
    .map((round, index) => {
      const assistantAction = round.assistantAction ?? '(未知)';
      return [
        `### Round ${index + 1}`,
        `userSummary: ${round.userSummary}`,
        `assistantSummary: ${round.assistantSummary || '(空)'}`,
        `roundSummary: ${round.roundSummary}`,
        `assistantAction: ${assistantAction}`,
      ].join('\n');
    })
    .join('\n\n');
}

export function buildDialogueConstructionPrompt(
  input: DialogueConstructionInput
): string {
  const soul = input.soul.trim() || '(空)';
  const profile = input.userProfile.trim() || '(空)';
  const observation = input.observationResult.observation;
  const updatedState = input.observationResult.updatedState;
  const outputLanguage = input.outputLanguage === 'en' ? 'English' : '中文';
  const expectation = formatExpectation(input.expectation);
  const rounds = formatRoundSummaries(input.recentRoundSummaries);
  const lastSystemAction = input.lastSystemAction ?? '(无上一轮系统动作)';
  const uiState = input.uiState?.status ?? '(本版占位，不参与决策)';
  const topicArousalContext = input.topicArousalContext;

  return `## 系统目标
你服务于“夜间恐惧驱动型焦虑”的低唤醒聊天系统。
本轮只决定对话怎么走，不负责写回复台词。
目标是根据当前话题承载用户：如果用户仍在高认知话题里表达，就允许维持相对更高的刺激；如果系统要主动转移或新建话题，则必须沿认知刺激递减。

## Soul
${soul}

## 用户画像
${profile}

## 输出语言
本轮最终回复必须使用${outputLanguage}。

## Observation 结果
cognitiveActivity=${observation.cognitiveActivity}
isInterrupting=${observation.isInterrupting}
willingToExpress=${observation.willingToExpress}
aiTooVerbose=${observation.aiTooVerbose}
reasoning=${observation.reasoning}

## Observation 更新后的状态
arousalLevel=${updatedState.arousalLevel}
willingnessToExpress=${updatedState.willingnessToExpress}
aiVerbosity=${updatedState.aiVerbosity}
turnCount=${updatedState.turnCount}

## 上一轮预期
${expectation}

## 上一轮系统动作
${lastSystemAction}

## 当前 UI 状态
${uiState}

## 话题导向唤醒度上下文
currentTopicLabel=${topicArousalContext.currentTopicLabel}
currentTopicCategory=${topicArousalContext.currentTopicCategory}
currentStimulusLevel=${topicArousalContext.currentStimulusLevel}
previousStimulusLevel=${topicArousalContext.previousStimulusLevel || '(无)'}
topicRelation=${topicArousalContext.topicRelation}
recommendedAction=${topicArousalContext.recommendedAction}
allowedShiftStimulusLevel=${topicArousalContext.allowedShiftStimulusLevel}
transitionRule=${topicArousalContext.transitionRule}
rationale=${topicArousalContext.rationale}

## 最近 6 轮结构化摘要
${rounds}

## 用户最新消息
${input.latestUserMessage}

---

请判断：
1. 用户这次回复是否符合上一轮预期
2. 当前话题是什么
3. 当前话题所处阶段
4. 下一步应该延续、提问、分析、转移，还是安静收束
5. 是否需要抽象层面的“素材搜索决策”

重要限制：
- 不要生成最终自然语言回复
- 不要安慰用户
- 不要执行搜索
- 不要写记忆
- 如果输出语言是 English，策略设计也要服务于自然英文表达，不要走会导致英文生硬的中文式路径
- 如果 topicRelation=continue，且用户仍在高认知或中认知话题中表达，可以维持当前刺激级别，不要为了“降刺激”假装听不懂
- 如果 topicRelation=user_shift，说明是用户主动带来了新话题；你可以接住它，但系统后续若要再主动转移，必须低于 currentStimulusLevel
- 只有当系统主动“转移/新建话题”时，才必须遵守递减规则；跟随用户继续展开当前高认知话题，不算违规
- 当你决定 shift 时，topicStep 必须写清楚要降到什么刺激级别，并且不能高于 allowedShiftStimulusLevel
- 如果用户表达意愿低、认知活跃度低，或 aiTooVerbose=true，请在 replyPlan 里明确要求缩短输出
- 如果 shouldSearchMaterials=false，则 searchQuery 和 searchPurpose 必须都为空字符串
- 如果上一轮预期为空，expectationMatch 必须输出 "none"

只输出下面这个 JSON：
\`\`\`json
{
  "expectationMatch": "matched",
  "currentTopic": "用户仍在讲职业方向与现实撕裂",
  "topicStage": "延续中",
  "replyPlan": "先承接当前高认知冲突，允许保留一定刺激，不要把抽象张力硬拽成低信息量问句。",
  "topicStep": "先顺着职业方向与现实撕裂继续一小步；如果后续转移，再降到 medium 刺激的话题。",
  "responseMode": "analyze",
  "shouldSearchMaterials": false,
  "searchQuery": "",
  "searchPurpose": ""
}
\`\`\`

只输出 JSON。`;
}
