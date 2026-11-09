import { Role } from '@prisma/client';

/** Người dùng đã xác thực, gắn vào `request.user` */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}
