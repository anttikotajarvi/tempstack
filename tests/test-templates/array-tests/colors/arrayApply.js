module.exports = (args, ctx, { apply }) => {
  // Anchored at "colors", so return the value for the "colors" slot directly.
  // Inside an array, apply("x") resolves from colors/[]/x.*
  return [apply("red"), apply("blue"), apply("dark::red")];
};