import fc from "fast-check";

// Few runs locally, more in CI. A failing property prints the counterexample, the seed and the
// path; replay it with `FC_SEED=<seed> FC_PATH=<path> pnpm test:unit`.
const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;
const path = process.env.FC_PATH;

fc.configureGlobal({
  numRuns: process.env.CI ? 1000 : 50,
  verbose: fc.VerbosityLevel.Verbose,
  ...(seed === undefined ? {} : { seed }),
  ...(path === undefined ? {} : { path }),
});
