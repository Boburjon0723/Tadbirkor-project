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

export type InventoryRealtimePayload = {
  warehouseId?: string;
  productId?: string;
  productVariantId?: string;
  reason?: string;
};

export type DebtsChangedPayload = {
  partnerCompanyId?: string;
  debtEntryId?: string;
  reason?: string;
};

@WebSocketGateway({
  namespace: '/inventory',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class InventoryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(InventoryGateway.name);

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
        (client.handshake.query?.token as string | undefined) ||
        extractTokenFromCookieHeader(cookieHeader);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      const companyId = String(payload?.companyId || '').trim();
      if (!companyId) {
        client.disconnect(true);
        return;
      }

      client.join(this.companyRoom(companyId));
      this.logger.debug(`Inventory socket connected: company=${companyId}`);
    } catch (error) {
      this.logger.warn(`Inventory socket auth failed: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.debug(`Inventory socket disconnected: ${client.id}`);
  }

  emitToCompany(companyId: string, event: string, payload: InventoryRealtimePayload) {
    if (!this.server) return;
    this.server.to(this.companyRoom(companyId)).emit(event, payload);
  }

  emitOrdersChanged(
    companyId: string,
    payload?: { orderId?: string; reason?: string },
  ) {
    if (!this.server) return;
    this.server.to(this.companyRoom(companyId)).emit('orders:changed', payload || {});
  }

  emitDashboardRefresh(companyId: string) {
    if (!this.server) return;
    this.server
      .to(this.companyRoom(companyId))
      .emit('dashboard:refresh', { at: Date.now() });
  }

  emitDebtsChanged(companyId: string, payload?: DebtsChangedPayload) {
    if (!this.server) return;
    this.server
      .to(this.companyRoom(companyId))
      .emit('debts:changed', { at: Date.now(), ...payload });
  }

  emitImportProgress(
    companyId: string,
    payload: {
      jobId: string;
      status: string;
      processedRows: number;
      totalRows: number;
      successRows: number;
      failedRows: number;
      errorMessage?: string | null;
    },
  ) {
    if (!this.server) return;
    this.server.to(this.companyRoom(companyId)).emit('import:progress', payload);
  }

  private companyRoom(companyId: string) {
    return `company:${companyId}`;
  }
}
