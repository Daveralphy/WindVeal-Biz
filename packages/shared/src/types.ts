export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'RECRUITER' | 'HIRING_MANAGER';
  organizationId: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}