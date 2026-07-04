// Type-level support for the WG API `fields` parameter: constrain requested
// fields to a response's real (dotted) paths, and narrow the return type to
// exactly what was requested.

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

/**
 * A value has no deeper dotted paths when it is a primitive, an array of
 * primitives, or an associative array (index signature). An array of objects
 * is NOT a leaf: WG lets you dot into its element fields (`members.account_id`).
 */
type Leaf<T> = T extends Primitive
  ? true
  : T extends readonly unknown[]
    ? NonNullable<ElementOf<T>> extends object
      ? false
      : true
    : string extends keyof T // associative array (index signature) → leaf
      ? true
      : false;

/** The dotted paths under `V`, descending into array element objects. */
type SubPaths<V> = V extends readonly unknown[]
  ? FieldPath<NonNullable<ElementOf<V>>>
  : FieldPath<V>;

/**
 * Union of the dotted field paths of `T`, at every depth — e.g. for
 * `{ a: number; b: { c: number } }` → `"a" | "b" | "b.c"`. Arrays of objects
 * expose both the whole-array path and the element sub-paths.
 */
export type FieldPath<T> = Leaf<T> extends true
  ? never
  : {
      [K in Extract<keyof T, string>]: Leaf<NonNullable<T[K]>> extends true
        ? K
        : K | `${K}.${SubPaths<NonNullable<T[K]>>}`;
    }[Extract<keyof T, string>];

type ChildPath<P extends string, K extends string> = P extends `${K}.${infer R}`
  ? R
  : never;

/**
 * Reconstruct `T` keeping only the paths present in the union `P`. A key is
 * kept whole when `P` names it directly (`"stats"`), or recursed when `P` only
 * names sub-paths (`"stats.wins"`). Arrays are narrowed element-wise.
 */
export type SelectFields<T, P extends string> = T extends readonly (infer E)[]
  ? SelectFields<NonNullable<E>, P>[]
  : {
      [K in Extract<keyof T, string> as K extends P
        ? K
        : [ChildPath<P, K>] extends [never]
          ? never
          : K]: K extends P ? T[K] : SelectFields<NonNullable<T[K]>, ChildPath<P, K>>;
    };

/** The narrowed result type for a call selecting field paths `F` from `T`. */
export type Selected<T, F extends readonly string[]> = [F[number]] extends [never]
  ? T
  : SelectFields<T, F[number]>;
