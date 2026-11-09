import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface TaskChangedEvent {
  projectId: number;
  taskId: number;
}

/** Cầu nối nội bộ: service nghiệp vụ phát sự kiện, gateway Socket.IO đẩy xuống client */
@Injectable()
export class RealtimeService {
  readonly taskChanged$ = new Subject<TaskChangedEvent>();

  taskChanged(projectId: number, taskId: number): void {
    this.taskChanged$.next({ projectId, taskId });
  }
}
