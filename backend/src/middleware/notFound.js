const { AppError } = require('./errorHandler');

const notFound = (req, res, next) => {
  const message = `Can't find ${req.originalUrl} on this server!`;
  next(new AppError(message, 404));
};

module.exports = notFound;