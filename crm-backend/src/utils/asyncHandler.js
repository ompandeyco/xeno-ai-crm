// asyncHandler.js — Utility wrapper to avoid try/catch in every controller
// Instead of writing try/catch in every async controller,
// wrap the function with this helper and errors go to errorHandler automatically.

// Usage: router.get('/route', asyncHandler(myController))

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
