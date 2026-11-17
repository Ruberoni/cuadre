// Violation: a primitive imports a screen.
import { page } from "../../routes/page.ts";

export const reachesIntoRoutes = page;
