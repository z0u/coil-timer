// Minimal re-export for fast-deep-equal from ajv's dependency
// This avoids adding to the bundle size
import deepEqual from 'fast-deep-equal';
export default deepEqual;
