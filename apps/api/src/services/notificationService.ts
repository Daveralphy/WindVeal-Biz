import prisma from '../lib/prisma.js';

/**
 * Create a notification for all users in an organization.
 * Optionally exclude the acting user (so you don't notify yourself).
 */
export async function notifyOrgUsers(
  organizationId: string,
  type: string,
  payload: Record<string, string | number>,
  excludeUserId?: string,
) {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });

  const targets = excludeUserId
    ? users.filter((u) => u.id !== excludeUserId)
    : users;

  if (targets.length === 0) return;

  await prisma.notification.createMany({
    data: targets.map((u) => ({
      userId: u.id,
      type: type as any,
      payload,
    })),
  });
}
