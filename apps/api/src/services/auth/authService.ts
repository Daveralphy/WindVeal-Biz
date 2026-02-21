import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { LoginRequest, RegisterRequest } from '../../types'; // Assuming types will be created

export const registerUser = async (data: RegisterRequest) => {
  const { email, password, organizationName, firstName, lastName } = data;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Transaction to create Org and User together
  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'ADMIN',
        organizationId: organization.id,
      },
    });

    return user;
  });

  return result;
};

export const loginUser = async (data: LoginRequest) => {
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  return user;
};