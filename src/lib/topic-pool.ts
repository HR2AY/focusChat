import { Topic } from '@/types';
import { logInfo } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 话题素材库
 * 
 * 格式：话题概览（十个字以内）+意图（这个话题是为了什么）+500字左右的原文
 */

// 素材库文件路径
const TOPIC_POOL_PATH = path.join(process.cwd(), 'src', 'data', 'topic-pool.md');

/**
 * 解析素材库文件
 */
function parseTopicPool(): Topic[] {
  try {
    const content = fs.readFileSync(TOPIC_POOL_PATH, 'utf-8');
    const topics: Topic[] = [];
    
    // 按 --- 分割话题
    const sections = content.split('---').filter(s => s.trim());
    
    for (const section of sections) {
      // 提取概览
      const overviewMatch = section.match(/\*\*概览\*\*[：:]\s*(.+)/);
      // 提取意图
      const intentMatch = section.match(/\*\*意图\*\*[：:]\s*(.+)/);
      // 提取原文
      const contentMatch = section.match(/\*\*原文\*\*[：:]\s*\n\n([\s\S]+?)(?=\n\n---|\n\n##|\s*$)/);
      
      if (overviewMatch && contentMatch) {
        const overview = overviewMatch[1].trim();
        const intent = intentMatch ? intentMatch[1].trim() : '';
        const topicContent = contentMatch[1].trim();
        
        // 生成ID
        const id = overview.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-').toLowerCase();
        
        topics.push({
          id: `pool-${id}`,
          name: overview,
          keyword: overview,
          tags: intent ? [intent] : [],
          // 存储完整内容（包括概览、意图、原文）
          fullContent: `【${overview}】${intent ? `\n意图：${intent}` : ''}\n\n${topicContent}`,
        });
      }
    }
    
    logInfo('topic-pool', `Loaded ${topics.length} topics from pool`);
    return topics;
  } catch (error) {
    logInfo('topic-pool', `Failed to load topic pool: ${error}`);
    return [];
  }
}

// 缓存话题池
let cachedTopics: Topic[] | null = null;

/**
 * 获取话题池
 */
export function getTopicPool(): Topic[] {
  if (!cachedTopics) {
    cachedTopics = parseTopicPool();
  }
  return cachedTopics;
}

/**
 * 根据关键词查找话题
 */
export function findTopicByKeyword(keyword: string): Topic | null {
  const pool = getTopicPool();
  const lowerKeyword = keyword.toLowerCase();
  
  return pool.find(topic => 
    topic.keyword.toLowerCase().includes(lowerKeyword) ||
    topic.name.toLowerCase().includes(lowerKeyword) ||
    topic.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
  ) || null;
}

/**
 * 根据ID查找话题
 */
export function findTopicById(id: string): Topic | null {
  const pool = getTopicPool();
  return pool.find(topic => topic.id === id) || null;
}

/**
 * 获取随机话题
 */
export function getRandomTopic(): Topic {
  const pool = getTopicPool();
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * 获取所有话题
 */
export function getAllTopics(): Topic[] {
  return [...getTopicPool()];
}

/**
 * 重新加载话题池（用于动态更新）
 */
export function reloadTopicPool(): void {
  cachedTopics = null;
  logInfo('topic-pool', 'Topic pool reloaded');
}
