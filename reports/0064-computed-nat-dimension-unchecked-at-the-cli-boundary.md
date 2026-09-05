# 0064: a computed Nat dimension is not checked at the CLI boundary

- Status: open
- Found: 2026-09-05, while triaging golden tests that were skipped with no recorded reason
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

A Nat-parameterized dimension is checked where a value enters the program.
`Vector n a` does this: the runtime rejects an argument whose length is not
`n`, and the message says so.

`Matrix m n a` is a newtype whose wire form is
`((Int, Int), Vector (m * n) a)` (`lib/stdlib/tensor/main.loc:8`), so the same
rule should reach the flat payload: a `Matrix 2 3 Int` argument should carry
exactly six elements, and the dimension pair it carries should be the one its
type declares.

## Observed

The literal dimension is checked, the computed one is not.

`Vector 3 Int` behaves:

```
$ ./v vec '[1,2,3]'
[1,2,3]
$ ./v vec '[1,2]'
Error: failed to parse argument #0: Array length mismatch: expected 3, got 2
```

`Matrix 2 3 Int` accepts anything whose outer shape is a 2-tuple:

```
$ ./v mat '[[2,3],[1,2,3,4,5,6]]'      # correct
[[2,3],[1,2,3,4,5,6]]
$ ./v mat '[[2,3],[1,2,3,4,5]]'        # five elements, m*n is six
[[2,3],[1,2,3,4,5]]
$ ./v mat '[[9,9],[1,2,3,4,5,6]]'      # dimension pair contradicts the type
[[9,9],[1,2,3,4,5,6]]
$ ./v mat '[[1,2],[3,4]]'              # two elements, m*n is six
[[1,2],[3,4]]
```

All four are accepted and returned. Only the tuple arity is enforced, which is
what the error on a non-pair reports:

```
$ ./v mat '[[1,2,3],[4,5,6]]'
Error: failed to parse argument #0: serialization error: expected 2 fields, got 3
```

## Reproduce

```morloc
module v (vec, mat)
import root
import tensor

vec :: Vector 3 Int -> Vector 3 Int
vec x = x

mat :: Matrix 2 3 Int -> Matrix 2 3 Int
mat x = x
```

Then `morloc make -o v v.loc` and the commands above.

## Impact

A `Matrix` argument is a shape contract that the boundary does not hold to.
The value flows into the program carrying a length that does not match its
type and, in the third case above, carrying its own dimension pair that
disagrees with the type it was accepted as. Anything downstream that trusts
the type -- an index calculation, a `matmul` whose inner dimensions were
supposed to line up -- is then working from a false premise.

Narrow in reach today, since it needs a Nat-parameterized newtype and only
`tensor` ships one. It is on the "advanced types" side of the library rather
than the first-user path.

## Guess

Unverified. `Vector n a`'s dimension is a literal Nat that survives into the
wire schema as an array length, which is why it is enforced. Inside Matrix the
dimension is `m * n` -- a `NatMulT` over the newtype's own parameters -- and
the enforcement appears not to survive either the multiplication or the
crossing into the newtype's wire form. Which of the two it is decides whether
the fix belongs in Nat reduction or in schema emission.

The dimension pair carried in the value is a separate question: nothing today
relates `((Int, Int), ...)` to the type's own `m` and `n`, so a check there
would be new behaviour rather than a repair.

## How this was hidden

`test-suite/golden-tests/nat-dim-runtime-pure` covers exactly this and was
never registered with the old hand-maintained test registry, so it never ran.
When `morloc` commit `6129de1a` moved to filesystem discovery it was found
unregistered and given a `SKIP` reading "Disabled with no recorded reason".
The test is itself obsolete -- it was written when `Matrix m n a` was an alias
for `[[a]]` -- so it cannot simply be turned back on; its SKIP now records
that, and points here.
