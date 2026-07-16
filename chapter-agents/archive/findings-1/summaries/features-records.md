# Morloc knowledge added by chapter 9 (features-records)

## Record declaration (legacy form — the only form the docs show)

```
record Person = Person
    { name :: Str
    , age  :: Int
    }
```

- Syntax is `record <TypeName> = <Tag> { field :: Type, ... }`.
- The `<Tag>` (second `Person`) does NOT create a term-level
  constructor. `alice = Person "Alice" 30` is a parse error
  (`unexpected type name 'Person'`). Values are built only with the
  record-literal form `{ name = ..., age = ... }`.
- The parser also accepts (undocumented in this chapter):
  - `record T where { name :: Str, age :: Int }` — new `where` form
    (`Parser.y:315`, `CstNamTypeWhere`).
  - `object T = Tag { ... }` / `object T where { ... }` — same
    behavior, different keyword (`Parser.y:326`).

## Concrete forms

```
record Py  => Person = "dict"
record R   => Person = "list"
record Cpp => Person = "person_t"
```

- Fields are NOT re-declared on the concrete side; the general record
  is the source of truth for names and types.
- For C++, the concrete tag (`person_t`) must be a struct available at
  compile time. In practice it comes in via a `source Cpp from
  "some.hpp" (...)` line that also brings in the struct definition; if
  no such source line references a file containing the struct, the
  pool won't know it exists.
- For Python and R, `dict` / `list` are builtins — no extra sourcing
  needed.

## Record literals

- `{ name = "Alice", age = 30 }` — order of fields is irrelevant
  (bound by name). `{ age = 30, name = "Alice" }` produces the same
  value.
- Missing a field, adding an undeclared field, or repeating a field
  are compile-time errors:
  - `Record literal does not match declared type Person: missing field(s): age`
  - `Record literal does not match declared type Person: unknown field(s): weight`
  - `duplicate field in record literal: name` (caret on 2nd)

## Wire format

- Records marshal as JSON objects (verified with the nexus:
  `{"name":"Alice","age":31}` for a `Person`).
- Field order in the JSON matches the declared order in the
  `record` block, not the record-literal order.
- Nexus `-h` prints a `Record Schemas:` section listing each field:
  ```
  Record Schemas:
    Person
      name :: Str
      age  :: Int
  ```

## Recursion (contradicts the chapter's WARNING)

- Bare self-recursion is rejected:
  `record Bad = Bad { a :: Bad }` →
  `Found unsupported self-recursive type alias: Bad`.
- List-guarded self-recursion **works** end-to-end, including cross-
  language (Python↔C++) round-trips of nested trees:
  ```
  record Tree = Tree { value :: Int, children :: [Tree] }
  record Py => Tree = "dict"
  record Cpp => Tree = "tree_t"
  ```
  In C++, the struct is `struct tree_t { int value; std::vector<tree_t> children; };`
  (a `std::vector` field satisfies the compiler's list-guard rule).
- Optional-guarded recursion (`?T`) is also allowed per the compiler
  (`library/Morloc/Frontend/Restructure.hs:74-134`, `classifyRecursion`),
  though not exercised in this chapter.

## Foo-example pattern for later chapters

```
foo name age = (rinc . pinc . cinc) { name = name, age = age }
```

- Type signature is optional here because `rinc`/`pinc`/`cinc` are all
  monomorphic `Person -> Person` — the whole expression is inferred as
  `Str -> Int -> Person` and does NOT trip the "skipping generic
  export" warning that earlier chapters kept hitting.

## Grammar reference (from Parser.y)

- `record_expr` at line 688: `'{' record_entries '}'` (record literal).
- `nam_type` at line 324: `record` | `object`.
- `nam_constructor` at line 334: `STRING` (concrete tag) or
  `UPPER`/`LOWER` (general tag).
- `checkRecordKeys` at line 1130: rejects duplicate literal fields.
- `checkRecordTypeKeys[Legacy]` at line 1144/1187: rejects duplicate
  declared fields.
