// tests/test-templates/site.js
module.exports = (args, ctx, { apply }) => {
  return {
    site: {
      title: args.title || "Site Title From Template",

      style: {
        // OBJECT PATH: ["site","style","color"]
        // => lookup under: <templateDir>/site/style/color/primary.*
        color: apply("primary"),

        // OBJECT PATH: ["site","style","darkColor"]
        // => lookup under: <templateDir>/site/style/darkColor/.dark/primary.*
        darkColor: apply("dark::primary")
      },

      // OBJECT PATH: ["site","hero"]
      // => lookup under: <templateDir>/site/hero/heroTheme.*
      hero: apply("heroTheme", { heroTitle: args.heroTitle })
    }
  };
};
