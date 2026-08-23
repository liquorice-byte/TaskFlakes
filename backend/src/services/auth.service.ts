import prisma from '../config/prisma.js';
import { hashPassword, verifyPassword, hashToken, verifyToken } from '../utils/hash.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { config } from '../config/index.js';
import type { RegisterInput, LoginInput, UpdateMeInput } from '../validations/schemas.js';

export const authService = {
  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);

    await this.saveRefreshToken(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  },

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);

    await this.saveRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!storedToken) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    const isValid = await verifyToken(refreshToken, storedToken.tokenHash);
    if (!isValid || storedToken.expiresAt < new Date()) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(
      payload.userId,
      payload.email
    );

    await this.saveRefreshToken(payload.userId, newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(userId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  },

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return user;
  },

  async updateUser(userId: string, input: UpdateMeInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: input.name ?? undefined },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    return user;
  },

  async deleteAccount(userId: string) {
    // Cascade on User relations (RefreshToken onDelete: Cascade via FK, UserSettings same).
    // Assignments + Subjects also have onDelete:Cascade on user FK via Prisma relation.
    await prisma.user.delete({ where: { id: userId } });
  },

  generateTokens(userId: string, email: string) {
    const accessToken = generateAccessToken({ userId, email });
    const refreshToken = generateRefreshToken({ userId, email });
    return { accessToken, refreshToken };
  },

  async saveRefreshToken(userId: string, token: string) {
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  },
};
