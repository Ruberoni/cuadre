import { z } from "zod";

/** One fixed `Role` per `User` (PLAN → Roles). Order is the seed's and the glossary's. */
export const ROLES = ["admin", "sales", "purchasing", "warehouse"] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/**
 * The signed-in user as the web sees it. `GET /api/auth/get-session` (Better Auth) answers
 * `{ session, user }` or `null`; the web parses `user` with this schema, so the role is typed.
 * Better Auth's own routes are not in the OpenAPI document: this schema is their contract.
 */
export const SessionUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: Role,
});
export type SessionUser = z.infer<typeof SessionUser>;
