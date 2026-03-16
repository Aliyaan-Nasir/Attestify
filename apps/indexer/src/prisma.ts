/**
 * Singleton Prisma client for the Attestify Indexer.
 */

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient | undefined {
  return prisma;
}

export async function connectToPostgreSQL(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined.');
    prisma = undefined;
    return false;
  }

  try {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: ['error'],
    });

    await prisma.$connect();
    console.log('Connected to PostgreSQL.');
    return true;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    prisma = undefined;
    return false;
  }
}

export async function disconnectPostgreSQL(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
