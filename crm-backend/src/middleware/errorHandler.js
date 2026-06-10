// errorHandler.js — Global error handling middleware
// Express calls this automatically when next(error) is called in any route.
// Having ONE central place for error formatting is a best practice.

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[ERROR] ${statusCode} - ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    // Stack trace only shown in development, never in production
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
