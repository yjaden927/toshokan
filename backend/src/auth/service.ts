import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { hashPassword, verifyPassword } from "./password.js";

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

// Checked against when the email doesn't exist, so a login for an unknown account takes as
// long as one with a wrong password and response times don't reveal which emails are registered.
const unknownUserHash = hashPassword("password for an account that does not exist");

export async function logIn(prisma: PrismaClient, input: { email: string; password: string }): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUser, passwordHash: true },
  });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await unknownUserHash));
  if (!user || !valid) return null;

  const { passwordHash: _, ...rest } = user;
  return rest;
}
