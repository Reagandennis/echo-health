/**
 * Makes the jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, …)
 * visible to TypeScript.
 *
 * `jest.setup.js` imports the matchers at runtime, but it is a `.js` file, so
 * the type augmentation it carries was never picked up by `tsc`. The tests
 * passed while `next build` failed its type-check step on ~21 "Property
 * 'toBeInTheDocument' does not exist" errors.
 */
import "@testing-library/jest-dom";
