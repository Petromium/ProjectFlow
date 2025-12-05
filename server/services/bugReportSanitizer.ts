/**
 * Bug Report Sanitization Service
 * Sanitizes user-submitted bug reports to prevent spam, abuse, and security issues
 */

import { logger } from "./cloudLogging";

export interface SanitizationResult {
  isValid: boolean;
  sanitized: {
    title: string;
    description: string;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
  };
  warnings: string[];
  blocked: boolean;
  blockReason?: string;
}

/**
 * Common spam patterns to detect
 */
const SPAM_PATTERNS = [
  /(?:buy|sell|cheap|discount|free money|click here|limited time)/i,
  /(?:http|https|www\.)/i, // URLs (allow in description but flag)
  /(?:bitcoin|crypto|investment|trading)/i,
  /(?:viagra|cialis|pharmacy)/i,
  /(?:casino|poker|gambling)/i,
];

/**
 * Profanity filter (basic - can be enhanced with a library)
 */
const PROFANITY_PATTERNS = [
  // Add common profanity patterns here if needed
  // For now, we'll rely on content length and structure checks
];

/**
 * Sanitize HTML and remove potentially dangerous content
 * IMPORTANT: Unescape HTML entities FIRST, then remove tags.
 * This prevents encoded tags like &lt;script&gt; from surviving tag removal
 * and then being unescaped back into dangerous content.
 */
function sanitizeHtml(text: string): string {
  // Step 1: First unescape HTML entities (in case input was pre-encoded)
  // This ensures encoded tags are decoded before we remove them
  let sanitized = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Step 2: Remove HTML tags AFTER unescaping
  // This ensures encoded tags like &lt;script&gt; are properly removed
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/<[^>]+>/g, ''); // Remove all remaining HTML tags

  // Step 3: Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Check for duplicate content (basic similarity check)
 */
function checkDuplicateContent(
  title: string,
  description: string,
  existingReports: Array<{ title: string; description: string }>
): boolean {
  const titleLower = title.toLowerCase().trim();
  const descLower = description.toLowerCase().trim();
  
  for (const report of existingReports) {
    const existingTitleLower = report.title.toLowerCase().trim();
    const existingDescLower = report.description.toLowerCase().trim();
    
    // Check title similarity (80% match)
    const titleSimilarity = calculateSimilarity(titleLower, existingTitleLower);
    if (titleSimilarity > 0.8) {
      return true;
    }
    
    // Check description similarity (70% match for longer descriptions)
    if (descLower.length > 50 && existingDescLower.length > 50) {
      const descSimilarity = calculateSimilarity(descLower, existingDescLower);
      if (descSimilarity > 0.7) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Validate and sanitize bug report content
 */
export async function sanitizeBugReport(
  report: {
    title: string;
    description: string;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
  },
  existingReports?: Array<{ title: string; description: string }>
): Promise<SanitizationResult> {
  const warnings: string[] = [];
  let blocked = false;
  let blockReason: string | undefined;

  // Sanitize all text fields
  const sanitized = {
    title: sanitizeHtml(report.title),
    description: sanitizeHtml(report.description),
    stepsToReproduce: report.stepsToReproduce ? sanitizeHtml(report.stepsToReproduce) : undefined,
    expectedBehavior: report.expectedBehavior ? sanitizeHtml(report.expectedBehavior) : undefined,
    actualBehavior: report.actualBehavior ? sanitizeHtml(report.actualBehavior) : undefined,
  };

  // Validate title
  if (sanitized.title.length < 10) {
    blocked = true;
    blockReason = "Title must be at least 10 characters long";
  } else if (sanitized.title.length > 255) {
    sanitized.title = sanitized.title.substring(0, 255);
    warnings.push("Title was truncated to 255 characters");
  }

  // Validate description
  if (sanitized.description.length < 50) {
    blocked = true;
    blockReason = "Description must be at least 50 characters long";
  } else if (sanitized.description.length > 10000) {
    sanitized.description = sanitized.description.substring(0, 10000);
    warnings.push("Description was truncated to 10,000 characters");
  }

  // Check for spam patterns
  const fullText = `${sanitized.title} ${sanitized.description}`.toLowerCase();
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(fullText)) {
      // URLs in description are okay, but flag them
      if (pattern.source.includes('http')) {
        warnings.push("Report contains URLs - please verify this is legitimate");
      } else {
        blocked = true;
        blockReason = "Report contains suspicious content";
        break;
      }
    }
  }

  // Check for excessive repetition (spam indicator)
  const words = fullText.split(/\s+/);
  const wordCounts: Record<string, number> = {};
  for (const word of words) {
    if (word.length > 3) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }
  
  const maxRepetition = Math.max(...Object.values(wordCounts));
  if (maxRepetition > words.length * 0.3) {
    blocked = true;
    blockReason = "Report contains excessive repetition";
  }

  // Check for duplicate content
  if (existingReports && existingReports.length > 0) {
    if (checkDuplicateContent(sanitized.title, sanitized.description, existingReports)) {
      warnings.push("Similar report may already exist");
      // Don't block, but warn admin
    }
  }

  // Check for meaningful content (not just random characters)
  const uniqueChars = new Set(sanitized.description.toLowerCase().replace(/\s/g, '')).size;
  if (uniqueChars < 10 && sanitized.description.length > 100) {
    blocked = true;
    blockReason = "Report appears to contain non-meaningful content";
  }

  const isValid = !blocked && sanitized.title.length >= 10 && sanitized.description.length >= 50;

  logger.info("[BUG_REPORT] Sanitization completed", {
    isValid,
    blocked,
    blockReason,
    warnings: warnings.length,
    titleLength: sanitized.title.length,
    descriptionLength: sanitized.description.length,
  });

  return {
    isValid,
    sanitized,
    warnings,
    blocked,
    blockReason,
  };
}

/**
 * Rate limit check for bug reports
 * Returns true if user can submit, false if rate limited
 */
export function checkRateLimit(
  userId: string,
  recentReports: Array<{ createdAt: Date }>
): { allowed: boolean; reason?: string; retryAfter?: number } {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Count reports in last hour
  const reportsLastHour = recentReports.filter(
    (r) => new Date(r.createdAt) > oneHourAgo
  ).length;

  // Count reports in last day
  const reportsLastDay = recentReports.filter(
    (r) => new Date(r.createdAt) > oneDayAgo
  ).length;

  // Rate limits
  if (reportsLastHour >= 5) {
    return {
      allowed: false,
      reason: "Too many reports submitted in the last hour. Please wait before submitting another report.",
      retryAfter: 3600, // 1 hour in seconds
    };
  }

  if (reportsLastDay >= 20) {
    return {
      allowed: false,
      reason: "Daily report limit reached. Please try again tomorrow.",
      retryAfter: 86400, // 24 hours in seconds
    };
  }

  return { allowed: true };
}

