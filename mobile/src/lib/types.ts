// Shapes of the data returned by the server (backend/src/users/userModel.js etc.).

/** 'client' is shown as "User" in the app. */
export type Role = 'super_admin' | 'admin' | 'trainer' | 'client';

/** Admin access switches set by the Super Admin. */
export type Permission = 'invite_trainers' | 'manage_trainers' | 'view_users';

export const PERMISSION_LABELS: Record<Permission, { title: string; detail: string }> = {
  invite_trainers: { title: 'Invite trainers', detail: 'Create and share trainer invitations' },
  manage_trainers: { title: 'Activate / deactivate trainers', detail: 'Switch their trainers on or off' },
  view_users: { title: 'View all users', detail: 'See the user list and user details' },
};
export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  trainer: 'Trainer',
  client: 'User',
};

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  profileCompleted: boolean;
  isArchived: boolean;
  status: 'active' | 'pending' | 'suspended';
  avatarUrl: string | null;
  joinedDate: string;
  whatsapp: string | null;
  permissions: Permission[];
  managedBy: string | null;
  trainerId: string | null;
  trainerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface AdminStats {
  clients: number;
  archivedClients: number;
  unassignedClients: number;
  trainers: number;
  myTrainers: number;
  admins: number;
  superAdmins: number;
  pendingInvitations: number;
}

/** GET /api/admin/overview — everything the Super Admin dashboard shows. */
export interface SuperOverview {
  totals: {
    admins: number; trainers: number; users: number;
    newThisMonth: { admins: number; trainers: number; users: number };
  };
  users: {
    active: number; inactive: number; unassigned: number; profilesCompleted: number;
    /** last 6 months, oldest first; month = 'YYYY-MM' */
    signupsByMonth: { month: string; count: number }[];
    recent: User[];
  };
  invitations: { pending: number; used: number; expired: number; revoked: number; latest: Invitation[] };
  trainers: TrainerSummary[];
  library: { videos: number; categories: number; workoutsSent: number; workoutsCompleted: number };
}

export interface TrainerSummary extends User {
  managerName: string | null;
  clientCount: number;
}

export interface TrainerUser extends User {
  currentStreak: number | null;
  lastPlanDate: string | null;
  unreadMessages: number;
}

export type InvitationStatus = 'pending' | 'used' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  role: 'admin' | 'trainer';
  name: string;
  email: string | null;
  whatsapp: string | null;
  permissions: Permission[];
  invitedBy: string;
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedByName: string | null;
  revokedAt: string | null;
  status: InvitationStatus;
}

/** What the invitation screen shows before the person accepts. */
export interface InvitationPreview {
  role: 'admin' | 'trainer';
  name: string;
  email: string | null;
  whatsapp: string | null;
  invitedByName: string | null;
  expiresAt: string;
}
