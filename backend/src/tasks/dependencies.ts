/**
 * Thêm cạnh "taskId phụ thuộc dependsOnId" có tạo vòng không? Có vòng nếu từ dependsOnId lần theo các phụ thuộc
 * hiện có mà tới được taskId (khi đó hai việc chờ nhau, không bao giờ bắt đầu được).
 */
export function wouldCreateCycle(edges: { taskId: number; dependsOnId: number }[], taskId: number, dependsOnId: number): boolean {
  if (taskId === dependsOnId) return true;
  const next = new Map<number, number[]>();
  for (const e of edges) next.set(e.taskId, [...(next.get(e.taskId) ?? []), e.dependsOnId]);
  const seen = new Set<number>();
  const stack = [dependsOnId];
  while (stack.length > 0) {
    const current = stack.pop() as number;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(next.get(current) ?? []));
  }
  return false;
}
