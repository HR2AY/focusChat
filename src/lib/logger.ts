/**
 * 日志工具
 * 用于记录错误和调试信息
 */

export function logError(context: string, error: Error | string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : error;
  
  console.error(`[${timestamp}] ERROR in ${context}:`, errorMessage);
  
  if (error instanceof Error && error.stack) {
    console.error('Stack:', error.stack);
  }
  
  if (data) {
    console.error('Data:', JSON.stringify(data, null, 2));
  }
}

export function logInfo(context: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] INFO in ${context}:`, message);
  
  if (data) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

export function logDebug(context: string, message: string, data?: unknown) {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toISOString();
    
    console.debug(`[${timestamp}] DEBUG in ${context}:`, message);
    
    if (data) {
      console.debug('Data:', JSON.stringify(data, null, 2));
    }
  }
}
