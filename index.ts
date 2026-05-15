// Probe stub — not meant to be executed.
// Exists solely to satisfy the project-creator output spec and
// give Mend's scanner a TypeScript entry-point to anchor detection.

import isOdd from "is-odd";

// Trivial usage so the import is not dead code.
const result: boolean = isOdd(1);
console.log(result);
