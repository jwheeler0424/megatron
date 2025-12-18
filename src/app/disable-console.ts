const noop = (..._args: unknown[]) => {};

// if (process.env.NODE_ENV !== 'development') {
console.log = noop;
// }

export {};
