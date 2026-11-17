// Violates domain-purity: domain imports infrastructure.
import { repository } from "../infrastructure/repository.ts";

export const used = repository;
