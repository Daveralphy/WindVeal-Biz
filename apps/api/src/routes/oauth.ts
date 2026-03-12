import { FastifyInstance, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';

function generateTokens(userId: string, organizationId: string, role: string, isSuperAdmin: boolean) {
  const accessToken = jwt.sign(
    { userId, organizationId, role, isSuperAdmin },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  );
  const refreshToken = jwt.sign(
    { userId, organizationId, role, isSuperAdmin },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: '30d' },
  );
  return { accessToken, refreshToken };
}

async function completeOAuthLogin(reply: FastifyReply, email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: true },
  });

  if (!user || !user.isActive) {
    return reply.redirect(`${env.APP_URL}/auth/callback?error=no_account`);
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.organizationId, user.role, user.isSuperAdmin);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const userPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    organizationLogo: user.organization.logoUrl,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    phone: user.phone,
    timezone: user.timezone,
  };

  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  const encoded = Buffer.from(JSON.stringify(userPayload)).toString('base64url');
  return reply.redirect(`${env.APP_URL}/auth/callback?token=${accessToken}&user=${encoded}`);
}

export async function oauthRoutes(app: FastifyInstance) {
  // ─── Google ───────────────────────────────────────────────────────────────

  app.get('/google', async (_request, reply) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return reply.redirect(`${env.APP_URL}/login?error=google_not_configured`);
    }

    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie('oauth_state_google', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300 });

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.API_URL}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/google/callback',
    async (request, reply) => {
      if (request.query.error || !request.query.code) {
        return reply.redirect(`${env.APP_URL}/login?error=google_denied`);
      }

      const saved = request.cookies.oauth_state_google;
      if (!saved || saved !== request.query.state) {
        return reply.redirect(`${env.APP_URL}/login?error=invalid_state`);
      }
      reply.clearCookie('oauth_state_google', { path: '/' });

      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: request.query.code,
            client_id: env.GOOGLE_CLIENT_ID!,
            client_secret: env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: `${env.API_URL}/api/auth/google/callback`,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenRes.json() as { access_token?: string };
        if (!tokenData.access_token) throw new Error('No access token');

        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileRes.json() as { email?: string };
        if (!profile.email) throw new Error('No email in profile');

        return completeOAuthLogin(reply, profile.email);
      } catch (err) {
        console.error('[OAuth] Google error:', err);
        return reply.redirect(`${env.APP_URL}/login?error=google_failed`);
      }
    },
  );

  // ─── Microsoft ────────────────────────────────────────────────────────────

  app.get('/microsoft', async (_request, reply) => {
    if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
      return reply.redirect(`${env.APP_URL}/login?error=microsoft_not_configured`);
    }

    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie('oauth_state_ms', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300 });

    const params = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      redirect_uri: `${env.API_URL}/api/auth/microsoft/callback`,
      response_type: 'code',
      scope: 'openid email profile User.Read',
      state,
      response_mode: 'query',
    });

    return reply.redirect(
      `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?${params}`,
    );
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/microsoft/callback',
    async (request, reply) => {
      if (request.query.error || !request.query.code) {
        return reply.redirect(`${env.APP_URL}/login?error=ms_denied`);
      }

      const saved = request.cookies.oauth_state_ms;
      if (!saved || saved !== request.query.state) {
        return reply.redirect(`${env.APP_URL}/login?error=invalid_state`);
      }
      reply.clearCookie('oauth_state_ms', { path: '/' });

      try {
        const tokenRes = await fetch(
          `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code: request.query.code,
              client_id: env.MICROSOFT_CLIENT_ID!,
              client_secret: env.MICROSOFT_CLIENT_SECRET!,
              redirect_uri: `${env.API_URL}/api/auth/microsoft/callback`,
              grant_type: 'authorization_code',
              scope: 'openid email profile User.Read',
            }),
          },
        );

        const tokenData = await tokenRes.json() as { access_token?: string };
        if (!tokenData.access_token) throw new Error('No access token');

        const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileRes.json() as { mail?: string; userPrincipalName?: string };

        const email = profile.mail ?? profile.userPrincipalName;
        if (!email) throw new Error('No email in profile');

        return completeOAuthLogin(reply, email);
      } catch (err) {
        console.error('[OAuth] Microsoft error:', err);
        return reply.redirect(`${env.APP_URL}/login?error=ms_failed`);
      }
    },
  );
}
