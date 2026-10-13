export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedUsersResponseDto {
  data!: UserResponseDto[];
  meta!: { page: number; limit: number; total: number; totalPages: number };
}

export function toUserResponse(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
