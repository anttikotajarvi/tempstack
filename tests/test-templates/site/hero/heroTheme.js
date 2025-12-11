// tests/test-templates/site/hero/heroTheme.js
module.exports = (args, ctx, { apply }) => {
  return {
    // ctx.anchor for this subtemplate is ["site","hero"]
    title: args.heroTitle || "Hero From Template",
    theme: {
      // OBJECT PATH inside this subtemplate's result: ["theme","color"]
      //
      // For this subtemplate:
      //   ctx.path = ["site","hero"]
      //   nodePath = ["theme","color"]
      //
      // So slotPath = ["theme","color"], and apply("colors::main") will look under:
      //   <templateDir> / site / hero / theme / color / .colors / main.*
      color: apply("colors::main")
    }
  };
};
