import type { CreateUserPayload, Paginated, UpdateUserPayload, User } from '@nest-vue/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { type UserRow, users } from '../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async list({ page = 1, size = 20 }: { page?: number; size?: number }): Promise<Paginated<User>> {
    const rows = await this.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(size)
      .offset((page - 1) * size);

    const [totalRow] = await this.db.select({ value: count() }).from(users);
    const total = totalRow?.value ?? 0;

    return {
      items: rows.map((row) => toUser(row)),
      page,
      size,
      total,
      totalPages: Math.max(1, Math.ceil(total / size)),
    };
  }

  async findOne(id: string): Promise<User> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!row) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return toUser(row);
  }

  async create(payload: CreateUserPayload): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({ email: payload.email, name: payload.name, role: 'member' })
      .returning();

    return toUser(row!);
  }

  async update(id: string, payload: UpdateUserPayload): Promise<User> {
    const [row] = await this.db.update(users).set(payload).where(eq(users.id, id)).returning();

    if (!row) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return toUser(row);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db.delete(users).where(eq(users.id, id)).returning({ id: users.id });

    if (deleted.length === 0) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
