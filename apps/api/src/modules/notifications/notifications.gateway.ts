import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { extractTokenFromCookieHeader } from '../../common/auth-cookie';
import { createSocketCorsOrigin } from '../../common/cors.util';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: createSocketCorsOrigin(),
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const rawAuth = client.handshake.auth?.token as string | undefined;
      const authHeader = client.handshake.headers?.authorization as string | undefined;
      const cookieHeader = client.handshake.headers?.cookie as string | undefined;
      const token =
        rawAuth ||
        (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined) ||
        extractTokenFromCookieHeader(cookieHeader);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      const userId = payload?.sub;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      client.join(this.userRoom(userId));
      this.logger.debug(`Notification socket connected: ${userId}`);
    } catch (error) {
      this.logger.warn(`Notification socket auth failed: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.debug(`Notification socket disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}

