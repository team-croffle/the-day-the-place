import type { ApiResponse, Paginated, User } from '@nest-vue/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { type AdminRequest, AdminSessionGuard } from '../auth/admin-session.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AdminSessionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query() query: ListUsersQuery): Promise<ApiResponse<Paginated<User>>> {
    return { data: await this.usersService.list(query) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<User>> {
    return { data: await this.usersService.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<User>> {
    return { data: await this.usersService.create(dto) };
  }

  @Patch(':id')
  async update(
    @Req() request: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<ApiResponse<User>> {
    return { data: await this.usersService.update(actorId(request), id, dto) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.usersService.remove(actorId(request), id);
  }
}

function actorId(request: AdminRequest): string {
  if (!request.adminUserId) throw new UnauthorizedException();
  return request.adminUserId;
}
