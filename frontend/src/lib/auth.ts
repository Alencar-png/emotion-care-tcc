"use client";

import { UserRole } from "@/types";

interface TokenPayload {
  sub: string;
  role: string;
  company_id: number | null;
  exp: number;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = parseToken(token);
    if (!payload) return false;
    // Verificar expiração
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

export function parseToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export function getCurrentUserFromToken(): {
  email: string;
  role: UserRole;
  company_id: number | null;
} | null {
  const token = getToken();
  if (!token) return null;

  const payload = parseToken(token);
  if (!payload) return null;

  return {
    email: payload.sub,
    role: payload.role as UserRole,
    company_id: payload.company_id,
  };
}

export function hasRole(requiredRoles: UserRole[]): boolean {
  const user = getCurrentUserFromToken();
  if (!user) return false;
  return requiredRoles.includes(user.role);
}

export function isSuperAdmin(): boolean {
  return hasRole([UserRole.SUPER_ADMIN]);
}

export function isCompanyAdminOrAbove(): boolean {
  return hasRole([UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);
}

export function isMedicalOrAbove(): boolean {
  return hasRole([
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.MEDICAL_TECHNICAL,
  ]);
}
