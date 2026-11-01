/**
 * MUSTAFAH-AI — MULTI-TENANT DOMAIN TYPES
 * Defines tenant boundaries, organizations, branches, memberships, and subscription entitlements.
 */

export type OrganizationRole = 'owner' | 'admin' | 'dentist' | 'receptionist' | 'staff';

export type OrganizationStatus = 'active' | 'demo_mode' | 'suspended' | 'archived';

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise' | 'custom';

export interface Organization {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  status: OrganizationStatus;
  subscriptionTier: SubscriptionTier;
  maxBranches: number;
  maxDoctors: number;
  monthlyDmQuota: number;
  contactPhone: string;
  contactEmail: string;
  addressAr?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  nameAr: string;
  slug: string;
  addressAr: string;
  phone: string;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  branchId?: string | null;
  role: OrganizationRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  organizationNameAr: string;
  userRole: OrganizationRole;
  currentBranchId?: string | null;
  isPlatformSuperadmin: boolean;
  isDemoMode: boolean;
}

export interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  monthlyDmQuota: number;
  maxBranches: number;
  maxDoctors: number;
  priceIqd: number;
  isActive: boolean;
}

export interface TenantAnomalyReportItem {
  tableName: string;
  totalRows: number;
  mappedRows: number;
  unmappedRows: number;
  missingParents: number;
  crossTenantViolations: number;
  invalidReferences: number;
}

