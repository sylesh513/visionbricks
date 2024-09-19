import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  constructor(private socket: Socket) {}

  emit(event: string, data: any) {
    this.socket.emit(event, data);
  }

  on(event: string) {
    return this.socket.fromEvent(event);
  }
}