// tests/test-templates/site/params.js
module.exports = (args, ctx, tools) => {
  return {
      flags: {
        env: args.env || "dev",
        debug: Boolean(args.debug)
      }
    }
};
