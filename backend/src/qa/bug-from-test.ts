import { BugSeverity, Priority } from '@prisma/client';

/** Mức nghiêm trọng gợi ý của Bug sinh ra từ test fail, theo độ ưu tiên của test case */
export const SEVERITY_BY_PRIORITY: Record<Priority, BugSeverity> = { urgent: 'critical', high: 'major', medium: 'major', low: 'minor' };

export interface BugDraftInput {
  testCase: { title: string; preconditions: string | null; steps: string; expected: string; priority: Priority };
  runName: string;
  note: string | null;
}

/** Nội dung Bug tự sinh khi một test case fail: đủ để dev tái hiện mà không phải hỏi lại QA */
export function buildBugDraft({ testCase, runName, note }: BugDraftInput): { title: string; description: string; severity: BugSeverity } {
  const lines = [`Phát hiện khi chạy kiểm thử "${runName}".`];
  if (testCase.preconditions) lines.push('', 'Tiền điều kiện:', testCase.preconditions);
  lines.push('', 'Các bước thực hiện:', testCase.steps, '', 'Kết quả mong đợi:', testCase.expected);
  lines.push('', 'Kết quả thực tế:', note?.trim() || '(QA chưa ghi chú)');
  return { title: `Lỗi khi kiểm thử: ${testCase.title}`.slice(0, 255), description: lines.join('\n'), severity: SEVERITY_BY_PRIORITY[testCase.priority] };
}
