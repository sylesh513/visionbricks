import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  constructor(private socket: Socket) {}

  // Method to trigger the 'run_workflow' event
  runWorkflow() {
    this.socket.emit('run_workflow');
  }

  // Listening for real-time task updates
  getTaskUpdates(): Observable<any> {
    return this.socket.fromEvent('task_update');
  }

  // Listening for job completion
  getJobCompletion(): Observable<any> {
    return this.socket.fromEvent('job_completed');
  }

  // Optional: Listen for execution in progress message
  getExecutionInProgress(): Observable<any> {
    return this.socket.fromEvent('execution_in_progress');
  }
}
