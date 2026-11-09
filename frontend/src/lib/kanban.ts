import type { TaskStatus } from '../types/api';

export const columnDroppableId = (status: TaskStatus): string => `column:${status}`;
