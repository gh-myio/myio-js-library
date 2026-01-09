/**
 * RFC-0135: Telegram Notification Queue - Telegram Client
 *
 * Provides wrapper for Telegram Bot API interactions.
 * Handles:
 * - Sending messages via Bot API
 * - Error handling (429 rate limits, 400 invalid config, network errors)
 * - Token masking in logs
 * - Configuration validation
 *
 * @module telegramClient
 */

import { logTelegramApi, logError, QueueLogger } from './logger.js';

/**
 * Telegram Bot API base URL
 */
const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Send message to Telegram via Bot API
 *
 * @param {Object} config - Telegram configuration
 * @param {string} config.botToken - Telegram bot token
 * @param {string} config.chatId - Chat or group ID
 * @param {string} [config.parseMode='HTML'] - Parse mode (HTML, Markdown, MarkdownV2)
 * @param {boolean} [config.disableNotification=false] - Disable notification sound
 * @param {string} text - Message text to send
 * @returns {Promise<Object>} Telegram API response
 * @returns {boolean} response.ok - Whether request was successful
 * @returns {Object} response.result - Result object (if successful)
 * @returns {number} response.result.message_id - Message ID
 * @throws {Error} On network error or API error
 *
 * @example
 * const response = await sendMessage(
 *   { botToken: 'xxx', chatId: '-123' },
 *   'Alert: Temperature high!'
 * );
 * console.log(`Message sent with ID: ${response.result.message_id}`);
 */
export async function sendMessage(config, text) {
  try {
    const { botToken, chatId, parseMode = 'HTML', disableNotification = false } = config;

    // Validate configuration
    if (!botToken || !chatId) {
      throw new Error('botToken and chatId are required');
    }

    if (!text || typeof text !== 'string') {
      throw new Error('Message text is required and must be a string');
    }

    // Build API URL
    const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

    // Build request body
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
      disable_notification: disableNotification
    };

    QueueLogger.log(`Sending message to Telegram - Chat: ${chatId}, Length: ${text.length} chars`);

    // Send request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Handle response
    if (!response.ok) {
      // Telegram API error
      const errorCode = data.error_code || response.status;
      const errorDescription = data.description || 'Unknown error';

      logTelegramApi('sendMessage', errorCode, false);

      // Create detailed error
      const error = new Error(`Telegram API error: ${errorDescription}`);
      error.statusCode = errorCode;
      error.description = errorDescription;
      error.telegramResponse = data;

      throw error;
    }

    // Success
    logTelegramApi('sendMessage', 200, true);

    return data;
  } catch (error) {
    // Check for specific error types
    if (error.statusCode === 429) {
      // Rate limit hit
      QueueLogger.warn('Telegram API rate limit (429) - Should retry with backoff');
    } else if (error.statusCode === 400) {
      // Bad request (likely invalid token or chat ID)
      QueueLogger.error('Telegram API bad request (400) - Check bot token and chat ID');
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      // Network error
      QueueLogger.warn('Network error sending to Telegram - Connection failed');
    }

    logError('sendMessage', error, { chatId: config.chatId });
    throw error;
  }
}

/**
 * Validate Telegram configuration
 * Tests bot token and chat ID by attempting to send a test message
 *
 * @param {Object} config - Telegram configuration
 * @param {string} config.botToken - Telegram bot token
 * @param {string} config.chatId - Chat or group ID
 * @param {boolean} [sendTestMessage=false] - Whether to send actual test message
 * @returns {Promise<Object>} Validation result
 * @returns {boolean} result.valid - Whether configuration is valid
 * @returns {string} [result.error] - Error message if invalid
 * @returns {Object} [result.botInfo] - Bot information if valid
 *
 * @example
 * const result = await validateConfig({ botToken: 'xxx', chatId: '-123' });
 * if (result.valid) {
 *   console.log(`Bot: ${result.botInfo.first_name}`);
 * } else {
 *   console.error(`Invalid config: ${result.error}`);
 * }
 */
export async function validateConfig(config, sendTestMessage = false) {
  try {
    const { botToken, chatId } = config;

    // Basic validation
    if (!botToken || typeof botToken !== 'string') {
      return {
        valid: false,
        error: 'Bot token is required and must be a string'
      };
    }

    if (!chatId || typeof chatId !== 'string') {
      return {
        valid: false,
        error: 'Chat ID is required and must be a string'
      };
    }

    // Test bot token by calling getMe
    const getMeUrl = `${TELEGRAM_API_BASE}/bot${botToken}/getMe`;
    const getMeResponse = await fetch(getMeUrl);
    const getMeData = await getMeResponse.json();

    if (!getMeResponse.ok || !getMeData.ok) {
      return {
        valid: false,
        error: `Invalid bot token: ${getMeData.description || 'Unknown error'}`
      };
    }

    const botInfo = getMeData.result;

    // Optionally send test message
    if (sendTestMessage) {
      try {
        await sendMessage(config, '✅ Test message from Telegram Queue - Configuration valid!');
      } catch (error) {
        return {
          valid: false,
          error: `Failed to send test message: ${error.message}`,
          botInfo
        };
      }
    }

    return {
      valid: true,
      botInfo
    };
  } catch (error) {
    logError('validateConfig', error);
    return {
      valid: false,
      error: `Validation failed: ${error.message}`
    };
  }
}

/**
 * Format Telegram API error for display
 * Extracts key information from error object
 *
 * @param {Error} error - Error from Telegram API
 * @returns {string} Formatted error message
 *
 * @example
 * try {
 *   await sendMessage(config, text);
 * } catch (error) {
 *   console.error(formatTelegramError(error));
 * }
 */
export function formatTelegramError(error) {
  if (!error) {
    return 'Unknown error';
  }

  // Network error
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return 'Network error: Failed to connect to Telegram API';
  }

  // Telegram API error
  if (error.statusCode) {
    let message = `Telegram API error ${error.statusCode}`;

    if (error.description) {
      message += `: ${error.description}`;
    }

    // Add specific guidance for common errors
    if (error.statusCode === 429) {
      message += ' (Rate limit - retry with backoff)';
    } else if (error.statusCode === 400) {
      message += ' (Invalid bot token or chat ID)';
    } else if (error.statusCode === 401) {
      message += ' (Unauthorized - check bot token)';
    } else if (error.statusCode === 404) {
      message += ' (Chat not found - check chat ID)';
    }

    return message;
  }

  // Generic error
  return error.message || 'Unknown error';
}

/**
 * Mask bot token for logging
 * Shows only first 10 characters
 *
 * @param {string} token - Bot token
 * @returns {string} Masked token
 *
 * @example
 * const masked = maskToken('1234567890:ABCdefGHIjklMNOpqrsTUVwxyz');
 * console.log(masked); // "1234567890:***"
 */
export function maskToken(token) {
  if (!token || typeof token !== 'string') {
    return '***';
  }

  if (token.length <= 10) {
    return '***';
  }

  return token.substring(0, 10) + ':***';
}

/**
 * Check if error is retryable
 * Determines if message should be retried based on error type
 *
 * @param {Error} error - Error from Telegram API
 * @returns {boolean} True if error is retryable
 *
 * @example
 * try {
 *   await sendMessage(config, text);
 * } catch (error) {
 *   if (isRetryableError(error)) {
 *     // Queue for retry
 *   } else {
 *     // Mark as permanently failed
 *   }
 * }
 */
export function isRetryableError(error) {
  if (!error) {
    return false;
  }

  // Network errors - retryable
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  // Telegram API errors
  if (error.statusCode) {
    // 429 Rate Limit - retryable with backoff
    if (error.statusCode === 429) {
      return true;
    }

    // 5xx Server errors - retryable
    if (error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    // 4xx Client errors (except 429) - NOT retryable
    // These indicate invalid configuration or message content
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }
  }

  // Default: not retryable
  return false;
}

/**
 * Get retry delay from Telegram rate limit response
 * Extracts retry_after from 429 response
 *
 * @param {Error} error - Error from Telegram API
 * @returns {number} Retry delay in seconds (0 if not specified)
 *
 * @example
 * catch (error) {
 *   if (error.statusCode === 429) {
 *     const retryAfter = getRetryAfter(error);
 *     console.log(`Retry after ${retryAfter} seconds`);
 *   }
 * }
 */
export function getRetryAfter(error) {
  if (!error || !error.telegramResponse) {
    return 0;
  }

  const retryAfter = error.telegramResponse.parameters?.retry_after;

  if (typeof retryAfter === 'number' && retryAfter > 0) {
    return retryAfter;
  }

  return 0;
}

/**
 * Build Telegram deep link for chat
 * Useful for UI to show link to chat/group
 *
 * @param {string} chatId - Chat or group ID
 * @returns {string|null} Deep link URL or null if invalid
 *
 * @example
 * const link = buildChatLink('-1001234567890');
 * // Returns: "https://t.me/c/1234567890"
 */
export function buildChatLink(chatId) {
  if (!chatId || typeof chatId !== 'string') {
    return null;
  }

  // Private chat (positive number)
  if (!chatId.startsWith('-')) {
    return `https://t.me/${chatId}`;
  }

  // Group or supergroup (starts with -)
  // Remove -100 prefix for supergroups
  if (chatId.startsWith('-100')) {
    const cleanId = chatId.substring(4);
    return `https://t.me/c/${cleanId}`;
  }

  // Regular group (starts with -)
  const cleanId = chatId.substring(1);
  return `https://t.me/c/${cleanId}`;
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 * Escapes: <, >, &
 *
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 *
 * @example
 * const escaped = escapeHtml('Alert: <value> > 100');
 * // Returns: "Alert: &lt;value&gt; &gt; 100"
 */
export function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Truncate message text to Telegram's limit
 * Telegram allows max 4096 characters per message
 *
 * @param {string} text - Message text
 * @param {number} [maxLength=4096] - Maximum length
 * @returns {string} Truncated text
 *
 * @example
 * const text = truncateMessage(longText);
 * await sendMessage(config, text);
 */
export function truncateMessage(text, maxLength = 4096) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.substring(0, maxLength - 20);
  return truncated + '\n\n[Message truncated]';
}
