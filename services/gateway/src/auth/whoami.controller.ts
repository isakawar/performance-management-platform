import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('auth')
export class WhoAmIController {
  @Get('me')
  whoAmI(@Req() request: Request): unknown {
    return request.user;
  }
}
