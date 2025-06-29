/**
 * Utility functions for time calculations and formatting
 */

/**
 * Calculate and format the time difference between two timestamps
 * @param startTimestamp - ISO string of start time
 * @param endTimestamp - ISO string of end time
 * @returns Formatted string in Indonesian (e.g., "2 Jam 30 Menit 15 Detik")
 */
export function formatCompletionTime(startTimestamp: string, endTimestamp: string): string {
  try {
    const startTime = new Date(startTimestamp).getTime();
    const endTime = new Date(endTimestamp).getTime();
    
    if (isNaN(startTime) || isNaN(endTime)) {
      return 'Waktu tidak valid';
    }
    
    const diffMs = endTime - startTime;
    
    if (diffMs < 0) {
      return 'Waktu tidak valid';
    }
    
    return formatDurationMs(diffMs);
  } catch (error) {
    return 'Waktu tidak valid';
  }
}

/**
 * Format duration in milliseconds to Indonesian time format
 * @param durationMs - Duration in milliseconds
 * @returns Formatted string in Indonesian (e.g., "2 Jam 30 Menit 15 Detik")
 */
export function formatDurationMs(durationMs: number): string {
  if (durationMs < 0) {
    return 'Waktu tidak valid';
  }
  
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours} Jam`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes} Menit`);
  }
  
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} Detik`);
  }
  
  return parts.join(' ');
}

/**
 * Get completion time from task object
 * @param task - Task object that may contain startTimestamp, endTimestamp, or completionTimeMs
 * @returns Formatted completion time string or null if not available
 */
export function getTaskCompletionTime(task: any): string | null {
  // If completionTimeMs is available, use it directly
  if (task.completionTimeMs && typeof task.completionTimeMs === 'number') {
    return formatDurationMs(task.completionTimeMs);
  }

  // If both timestamps are available, calculate the difference
  if (task.startTimestamp && task.endTimestamp) {
    return formatCompletionTime(task.startTimestamp, task.endTimestamp);
  }

  return null;
}

/**
 * Format cancellation timestamp to Indonesian date/time format
 * @param cancelledTimestamp - ISO string of cancellation time
 * @returns Formatted string in Indonesian format or null if not available
 */
export function getTaskCancellationTime(task: any): string | null {
  if (!task.cancelledTimestamp) {
    return null;
  }

  try {
    const cancelledDate = new Date(task.cancelledTimestamp);
    if (isNaN(cancelledDate.getTime())) {
      return null;
    }

    return cancelledDate.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).replace('.', ':');
  } catch (error) {
    return null;
  }
}

/**
 * Get stop violation information with enhanced details
 * @param violation - Stop violation object
 * @returns Object with formatted stop information
 */
export function getStopViolationInfo(violation: any) {
  const startTime = new Date(violation.timestamp);

  // Format start time
  const startTimeFormatted = startTime.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  }).replace('.', ':');

  // Check if driver has resumed movement
  const hasResumed = violation.resumeTimestamp && violation.actualStopDurationMs;

  let resumeTimeFormatted = 'Belum berjalan';
  let actualDurationFormatted = 'Masih berhenti';

  if (hasResumed) {
    const resumeTime = new Date(violation.resumeTimestamp);
    resumeTimeFormatted = resumeTime.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).replace('.', ':');

    actualDurationFormatted = formatDurationMs(violation.actualStopDurationMs);
  }

  return {
    startTime: startTimeFormatted,
    resumeTime: resumeTimeFormatted,
    actualDuration: actualDurationFormatted,
    hasResumed,
    limitDuration: `${violation.durationMin} menit` // The limit that was exceeded
  };
}
