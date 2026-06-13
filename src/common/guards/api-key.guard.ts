import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const isGet = request.method === 'GET';
    if (isGet) {
      return true;
    }

    const apiKey = request.headers['x-api-key'];
    const validApiKey = this.configService.get<string>('API_KEY');

    if (!validApiKey) {
      throw new UnauthorizedException('API Key no configurada en el servidor');
    }
    if (!apiKey) {
      throw new UnauthorizedException('Header x-api-key es requerido');
    }
    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('API Key inválida');
    }

    return true;
  }
}
