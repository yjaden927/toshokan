import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { hashPassword } from "./password.js";

export const publicUser = { id: true, email: true, displayName: true } as const;

export type AuthUser = Prisma.UserGetPayload<{ select: typeof publicUser }>;

export class EmailTakenError extends Error {
  constructor() {
    super("Email is already registered");
    this.name = "EmailTakenError";
  }
}

export async function signUp(
  prisma: PrismaClient,
  input: { email: string; password: string; displayName: string },
): Promise<AuthUser> {
  try {
    return await prisma.user.create({
      data: { email: input.email, displayName: input.displayName, passwordHash: await hashPassword(input.password) },
      select: publicUser,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new EmailTakenError();
    }
    throw error;
  }
}
