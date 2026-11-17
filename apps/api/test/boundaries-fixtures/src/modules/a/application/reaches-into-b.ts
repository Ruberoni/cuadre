// Violates module-public-api: reaches into another module's internals.
import { secret } from "../../b/application/secret.ts";

export const used = secret;
