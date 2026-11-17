// Allowed: imports another module through its index.ts.
import { publicThing } from "../../b/index.ts";

export const used = publicThing;
