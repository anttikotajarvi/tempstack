## Notes
### `undefined` in function templates
- a function module returning undefined will work and set the scoped object field to `undefined`
- since undefined is not an actual JSON value the field will be removed from the rendered JSON
- This would seem to go against the cumulative nature of the system but since this is emergent behavior there are no plans to correct this.
```js
module.exports = () => {
    return undefined;
}
```
*What this means?*
```json
{
}
```
Is not the same as
```js
...
return {
  field: undefined
}
```
Since the JSON is simply empty while the JS function template actually deletes the existing field.

#### Example
```json
{
  "version": "0.0.1"
}
```
**+**
```js
  module.exports = () => {
    return {
      version: undefined
    }
}
```
**=**
```json
  {}
```

## Arrays and `[]` (array element anchor)

This system models template composition primarily through **object property paths**.
Arrays are supported via a special hard-coded path segment: `[]`.

### Whole-slot array templates (replace)
A template under:

- `colors/<tag>.json|js`

defines the **entire** value of the `colors` slot (replace semantics, like any other value).

Example:
- `colors/default.json` → `["base"]`
- Rendering `colors/default` sets `colors` to `["base"]`.

Arrays replace by default:
- Applying `colors/default` and then `colors/other` replaces the array.

### Element templates (push into array)
A template under:

- `colors/[]/<tag>.json|js`

does not replace `colors`.
Instead, its resolved return value is **pushed** into the array at `colors`.

Example:
- `colors/[]/red.json` → `"red"`
- Rendering `colors/[]/red` results in `colors: ["red"]`.

Rendering multiple element templates pushes in render-order:
- Render `colors/[]/red`, then `colors/[]/blue`
- Result: `colors: ["red", "blue"]`

### Type mismatch rule for `[]`
When applying `colors/[]/<tag>`:

- If `colors` is missing → it is created as `[]`, then the value is pushed.
- If `colors` exists and is an array → the value is pushed.
- If `colors` exists and is NOT an array (string/null/object/number/bool) → throw an error.

`null` is treated as an atomic value (not "unset").

### What gets pushed
The resolved JsonValue is pushed *as-is* (no flattening):
- If an element template returns `"red"`, push `"red"`
- If it returns `["a","b"]`, push it as a single element (nested array)

Thunks (like `apply(...)`) are allowed anywhere in the TemplateNode tree and must resolve before pushing.

### `apply(...)` inside arrays
When resolving a TemplateNode, descending into an array must switch to **array element context**.

Implementation convention:
- slotPath uses the special segment `"[]"` (hard-coded, not configurable)
- e.g. resolving `colors: [apply("red")]` means `apply("red")` resolves from `colors/[]/red.*`

So:
- Outside arrays: `apply("red")` resolves from `colors/red.*`
- Inside arrays:  `apply("red")` resolves from `colors/[]/red.*`

Group selection uses the configured `groupDirPrefix`.
If `groupDirPrefix` is `"."`, then:
- `apply("dark::red")` inside array resolves from `colors/[]/.dark/red.*`

### Implementation notes
- Use the hard-coded path segment `"[]"` in slotPath when descending into arrays.
- Detect `[]` in template IDs at render-merge time:
  - the target slot is the property path up to (but not including) the first `[]`
  - applying an element template pushes into that target slot
- Throw a clear op-specific error when pushing into a non-array slot.
