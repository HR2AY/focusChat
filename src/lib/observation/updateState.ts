/**
 * Observation Agent — State Persistence
 *
 * 读写 src/data/user-state.json
 */

import type { UserState } from './types';
import { logInfo, logError } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

const STATE_PATH = path.join(process.cwd(), 'src', 'data', 'user-state.json');

// ────────────────────────────────────────────
// 默认状态
// ────────────────────────────────────────────

const DEFAULT_STATE: UserState = {
  arousalLevel: 'high',
  willingnessToExpress: 'medium',
  aiVerbosity: 'normal',
  turnCount: 0,
  lastUpdated: '',
};

// ────────────────────────────────────────────
// 读取
// ────────────────────────────────────────────

export function readUserState(): UserState {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    // 简单校验
    return {
      arousalLevel: typeof data.arousalLevel === 'string' ? data.arousalLevel : DEFAULT_STATE.arousalLevel,
      willingnessToExpress: typeof data.willingnessToExpress === 'string' ? data.willingnessToExpress : DEFAULT_STATE.willingnessToExpress,
      aiVerbosity: typeof data.aiVerbosity === 'string' ? data.aiVerbosity : DEFAULT_STATE.aiVerbosity,
      turnCount: typeof data.turnCount === 'number' ? data.turnCount : DEFAULT_STATE.turnCount,
      lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : DEFAULT_STATE.lastUpdated,
    } as UserState;
  } catch (e) {
    logError('observation-state', e as Error);
    logInfo('observation-state', 'Using default state');
    return DEFAULT_STATE;
  }
}

// ────────────────────────────────────────────
// 写入
// ────────────────────────────────────────────

export function writeUserState(state: UserState): void {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    logInfo('observation-state', `State saved: arousal=${state.arousalLevel}, express=${state.willingnessToExpress}, verbosity=${state.aiVerbosity}, turns=${state.turnCount}`);
  } catch (e) {
    logError('observation-state', e as Error);
  }
}
