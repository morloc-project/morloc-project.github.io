# 3.17. Effects and delayed evaluation

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/effects.html | prev: https://morloc-project.github.io/docs/features/recursion.md | next: https://morloc-project.github.io/docs/features/random-access-and-streaming.md

An **effect** is something a computation does to or reads from the world: a file read, a network call, a random draw. A Morloc function maps its arguments to a result, and that is its whole meaning. But `readFile` read twice may return two different strings, so **when** it runs matters; and a coin toss or the current time is not a value at all.

Morloc gives the effect a name in the type. `<Rand> Bool` is not a `Bool`; it is a **suspension**: a computation that, when run, performs the `Rand` effect and yields a `Bool`.

## 3.17.1. The mental model

-   `<E> T` is a suspension. Holding one in a variable does nothing, and neither does passing it, storing it in a record or list, or returning it. It is a value, and the same value in every position.
-   The bind arrow `<-` runs a suspension once and gives you a result. Run it twice and it runs twice: nothing is remembered between runs.
-   A bare statement inside a `do`\-block runs a suspension and nothing reads the result. This is how you sequence side effects whose return values you do not need. If that result reports a failure, the block stops there; see [Failure is not an effect](#failure-is-not-an-effect).
-   `let` binds without running. If the right-hand side is a plain effectful expression, the suspension is what gets bound; it only fires when a later `<-` reaches for it.
-   `!e` is inline shorthand for `<-`. Instead of writing `x <- e` and using `x` downstream, write `!e` where you want the value; the compiler inserts the bind at the nearest enclosing scope.
-   When you export an `<E> T`, the compiled program runs it for you at the boundary. The caller receives a `T`.

Effect labels are names that the compiler propagates and checks for coverage. What an effect **means** — what `IO` permits at runtime, what `Rand` looks like operationally — is the business of the library that defines the effect, not the compiler. The compiler’s job is to keep the labels honest; libraries build behaviour on top.

## 3.17.2. Failure is not an effect

An effect row says what a computation may **do**. Whether it succeeded is a property of what it **returns**, so failure is not an effect and Morloc does not track it as one. A fallible operation returns a value that is either the answer or the reason there isn’t one:

```morloc
data Try e a = Err e | Ok a
```

That is an ordinary sum type (see [Sum types](https://morloc-project.github.io/docs/features/sum-types.md)), declared in the `internal` standard library module and re-exported by `root`. Nothing about it is built into the compiler. The error parameter comes first so that a later functor maps over the payload rather than the error.

A function that may fail says so by returning one, and the caller takes it apart the way it takes any sum type apart:

```morloc
source Py from "eff.py" ("lookupPort")
lookupPort :: Str -> <IO> (Try Str Int)

describePort :: Str -> <IO> Str
describePort name = do
  r <- lookupPort name
  match r
    | (Ok p)  = "port #{@show p}"
    | (Err e) = "unknown: #{e}"
```

```console
$ ./effects describePort https
"port 443"
$ ./effects describePort gopher
"unknown: no port for gopher"
```

The effect row still carries `IO`, because looking the port up does touch the world. What it no longer carries is any claim about failing.

`describePort` takes the `Try` apart inside the pool, but it does not have to: a `Try` crosses a pool boundary like any other value, and so does a list of them. Its wire form follows from its declaration, the way a tuple’s does, and no `Packable` instance stands between the two — see [A `do`\-block does not return a `Try`](#do-block-no-try) for a function that hands one back to its caller.

Failure that is **not** a value is still possible, and common: any function you source can raise in its own language, and Morloc does not see that coming. `@try` turns such a raise into a `Try` and `@throw` produces one deliberately; both are covered in [Failure and recovery](https://morloc-project.github.io/docs/features/intrinsics.md#failure-and-recovery). The honest summary is that a signature tells you what a call may do and what it returns, and not every way it can go wrong — a trade made for signatures that stay readable, since almost every function that touches the world can fail somehow.

## 3.17.3. Syntax

### Declaring an effect

Every effect label a program uses must be declared:

```morloc
effect IO
escapable effect Rand
```

The default form is inescapable; the `escapable` form is discussed in [Escapable and inescapable effects](#escapable). Declarations are global to the program; two modules cannot declare the same label with conflicting escapability.

A `<L>` that has not been declared is a compile error — the compiler does not know any effect names of its own.

One effect comes pre-declared, in the `internal` stdlib module that most user code imports transitively through `root`: `effect IO`. Every intrinsic that touches the world carries it. Every other label is yours to declare, in the module that establishes what it means.

### Annotating signatures

An effect annotation goes immediately before the type it wraps:

```morloc
readFile :: Path -> <IO> Str
rollDie  :: Int -> <Rand> Int
fetch    :: Url -> <IO, Net> Bytes
```

Multiple labels are comma-separated inside a single pair of angle brackets. Order does not matter; `<IO, Net>` and `<Net, IO>` are the same row.

The empty row `<>` is a row like any other: `<> T` is a suspension that performs nothing when run, and it is not a `T`. You rarely write it, but a `do`\-block that runs nothing has this type, and it fits any effect slot, since the empty row is included in every row (see [The rules](#rules)).

### do-blocks

A `do`\-block strings statements together. It is the only construct in which effects are actually run. Inside a block there are exactly four forms of statement:

| Form | Meaning |
| --- | --- |
| `x <- e` | Run `e`, bind the result to `x`. |
| `Ok x <- e` | Run `e`, match the result against a refutable pattern, and throw if it does not match. |
| `e` | (bare) Run `e`. Nothing reads the result. |
| `let x = e` | Bind `x` to `e` without running anything. |

The final statement of a `do`\-block is its return value. The block’s overall type is `<U> T`, where `U` is the union of all the statements' effects and `T` is the type of the final statement.

A worked example covering the three that run something:

```morloc
sideEffect :: Int -> <IO> Int
add        :: Int -> Int -> Int

example :: <IO> Int
example = do
    let t = sideEffect 3     -- t :: <IO> Int, NOT run
    sideEffect 1              -- runs, nothing reads the result
    x <- sideEffect 5         -- runs, x = 10
    let y = add x 1           -- y = 11, no run
    z <- t                    -- NOW t runs; z = 6
    add y z                   -- returns 17
```

```console
$ ./effects example
17
```

Both layout-indented form (as above) and brace form (`do { x <- e; y <- f; ... }`) are accepted.

### A bare statement checks its result

The bare form is how you write a script: a sequence of steps run for what they do, not for what they return. A step that can fail returns a `Try`, and a returned failure that nobody looks at is a failure nobody notices. So the rule is:

-   **A bare statement stops the block when its result is a failure.**

`logLine` appends a line to a log and refuses an empty one, so it returns a `Try`. Written bare, a failing line ends the run; the statements after it, including the block’s return value, never happen:

```morloc
source Py from "eff.py" ("record" as logLine)
logLine :: Str -> <IO> (Try Str ())

logTwo :: Str -> Str -> <IO> Str
logTwo a b = do
  logLine a
  logLine b
  "both recorded"
```

```console
$ ./effects logTwo alpha beta
recorded: alpha
recorded: beta
"both recorded"
$ ./effects logTwo alpha ""
recorded: alpha
Error: run failed
refusing to record an empty line
```

The rule is stated in terms of the statement’s **result**, and a bare statement is exactly the one whose result nothing reads. Bind it and the rule does not fire, because now something does read it and what happens next is your business. Binding to `_` is how you say that out loud — the failure goes into a hole on purpose:

```morloc
logTwoLoose :: Str -> Str -> <IO> Str
logTwoLoose a b = do
  _ <- logLine a
  _ <- logLine b
  "both recorded"
```

```console
$ ./effects logTwoLoose alpha ""
recorded: alpha
"both recorded"
```

### Refutable binds

A `do`\-bind may carry a refutable pattern (see [Refutable patterns](https://morloc-project.github.io/docs/features/pattern-matching.md#refutable-patterns)). It runs the statement, matches the result, and throws if the match fails. Against a `Try` that gives you the value on the success path and stops the block otherwise, which is the short way to write "I want the answer, and a failure here is fatal":

```morloc
portOf :: Str -> <IO> Int
portOf name = do
  Ok p <- lookupPort name
  p
```

```console
$ ./effects portOf https
443
$ ./effects portOf gopher
Error: run failed
{"Err":["no port for gopher"]}
  at portOf [py] (mid=6, effects.loc:1:68)
```

The thrown message is the unmatched value, rendered. A `Try` carries the failure’s own message, which is why `no port for gopher` shows up in the traceback above.

### A `do`\-block does not return a `Try`

The bare-statement rule covers a result nothing reads. It does not cover the block’s final statement, which **is** the block’s return value and so is read by whoever called it. A `Try` there is a `Try` in the block’s type, and if the signature says otherwise the block does not typecheck. `@savej` writes a value to a file and may fail, so it returns one (see [Intrinsics](https://morloc-project.github.io/docs/features/intrinsics.md)):

```morloc
saveNote :: Str -> [Str] -> <IO> ()
saveNote path xs = do
  @savej path (id xs)
```

```console
save-bad.loc:7:20-9:1: error:
Type mismatch:
  expected: <IO> Unit
  inferred: <IO> (Try Str Unit)
Cannot compare types Try Str Unit and Unit
  |
7 | | saveNote path xs = do
  | |                    ^
8 | |   @savej path (id xs)
  | | ^
```

Three ways out, and which is right depends on what the caller should see. Declare the `Try` and hand the failure back as data; unwrap it, which throws; or make the fallible call a bare statement and return something else:

```morloc
asData :: Str -> [Str] -> <IO> (Try Str ())
asData path xs = @savej path (id xs)

orThrow :: Str -> [Str] -> <IO> ()
orThrow path xs = do
  r <- @savej path (id xs)
  unwrap r

bareThenUnit :: Str -> [Str] -> <IO> ()
bareThenUnit path xs = do
  @savej path (id xs)
  ()
```

```console
$ ./save asData nope/x.json '["a"]'
Error: run failed
{"Err":["IO error: No such file or directory (os error 2)"]}
$ ./save bareThenUnit nope/x.json '["a"]'
Error: evaluation failed: IO error: No such file or directory (os error 2)
$ ./save bareThenUnit out.json '["a"]'
```

**\`+unwrap**

Try Str a → a+\` comes from the standard library and does exactly what the bare-statement rule does: hand back the `Ok` payload, or throw the `Err` message. It is the explicit form of the same decision. The two failing runs above differ only in who reports: `asData` returns the failure and the program prints it as its result, while the other two throw and the program dies. Both exit non-zero.

### When `do` is needed and when it isn’t

A `do`\-block is not always required. A single effectful expression stands on its own:

```morloc
forceOnce :: <IO> Int
forceOnce = sideEffect 5
```

Use a `do`\-block when you need to sequence multiple statements, bind intermediate results, or run a suspension for its effects only. A `do`\-block is itself an expression, so it can appear as an argument.

### The `!` eval prefix

Inside an expression, `!e` runs `e` in place. It is surface syntax only: the compiler rewrites it to a `<-` bind at the nearest enclosing scope and threads the bound name through. Effects propagate outward exactly as they would if you had written the bind by hand.

```morloc
readValue :: <IO> Int

pair :: <IO> (Int, Int)
pair = (!readValue, !readValue)
    -- equivalent to `do { a <- readValue ; b <- readValue ; (a, b) }`
```

```console
$ ./effects pair
[7,7]
```

The rewrite lands at the **nearest** enclosing scope. Inside a lambda body the inserted `do`\-block goes in the body, so the effect fires when the lambda is applied, not when it is created:

```morloc
addOne   :: Int -> <IO> Int

readOnce :: () -> <IO> Int
readOnce = \_ -> !(addOne 1)
    -- equivalent to `\_ -> do { v <- addOne 1 ; v }`
```

Inside a guard, each branch gets its own scope, so only the taken branch’s effect fires. Inside an existing `do`\-block, `!e` becomes a bind inserted immediately before the current statement, preserving left-to-right effect order.

The prefix binds tightly: `f !x` parses as `f (!x)`, not as `!(f x)`. Use parentheses for the latter.

`!` is rejected at positions where it would be redundant or would put an effect where the surface reads as pure:

-   `x <- !e` — the bind already runs `e`; write `x <- e`.
-   `!e` as a bare non-final `do`\-statement — bare statements already run.
-   `let x = !e` (or any `!` whose scope would land above the `let`) — `let` binds pure values; hoisting an effect above the binding would make the line read misleadingly. Use `x <- e` inside a `do`\-block. A `!` sealed by an inner boundary (a lambda body, a nested `do`, a guard branch under the let) is unaffected.

## 3.17.4. The rules

The rest of this section is reference: the typing rules behind the mental model, effect row variables for combinators, and escapable effects. You can write effectful programs without it.

There is no coercion between `<E> T` and `T` in either direction: running it with `<-` is the only way out of a suspension, and `do` is the only way in. The row `<E>` is an upper bound on what a run may do, so `do 42` already fills an `<IO> Int` slot, and Morloc needs no `pure` or `return` keyword. Keeping the two apart is what lets Morloc pass a suspension to another language as a callable, run it once per use, and know that nothing ran when it was merely held.

The type checker enforces four rules:

1.  **A value is not a suspension.** `T` never fills an `<E> T` slot; `do v` does. A `do`\-block that runs nothing has type `<> T`, and the empty row is included in every row, so `do v` fills any `<E> T` slot.
2.  **More effects are a supertype of fewer.** `<E1> T <: <E2> T` exactly when the concrete labels of `E1` are a subset of `E2`. A `<IO> Int` is usable where `<IO, Net> Int` is expected; the reverse is not.
3.  **Effects don’t leak silently.** A value of type `<E> T` cannot be assigned to a slot of type `T`. It can fill a type variable, since it is a value like any other: `id (readValue)` is an `<IO> Int`, and a list of suspensions is a list. If you intend the effect to escape, you say so in the type.
4.  **A `do`\-block collects.** Its row is the union of its statements' rows; its type is `<that-union> T`, where `T` is the type of its final statement.

**The rules at work**

```morloc
-- Rule 1: a suspension of a value fills an <IO> slot; the value does not
pureFortyTwo :: <IO> Int
pureFortyTwo = do 42               -- OK
notASuspension :: <IO> Int
notASuspension = 42                -- ERROR: Int is not <IO> Int

-- Rule 2: widening is fine
ioFunc      :: <IO> Int
testSubtype :: <IO, Net> Int
testSubtype = do
  x <- ioFunc
  x                                -- OK: <IO> <: <IO, Net>

-- Rule 2: narrowing is rejected
readValue :: <IO, Net> Int
a         :: <IO> Int
a = do
  x <- readValue                   -- ERROR: Net not in <IO>
  x

-- Rule 3: effects can't be dropped into a pure slot
readValue :: <IO> Int
b         :: Int
b = readValue                      -- ERROR: <IO> Int is not Int

-- Rule 4: the union of statements' effects
readValue :: <IO> Int
sample    :: Int -> <Rand> Int

combined :: <IO, Rand> Int
combined = do
  x <- readValue                   -- contributes <IO>
  y <- sample x                    -- contributes <Rand>
  y
```

The three rejections above are real. A value in a suspension’s slot:

```console
rule1.loc:7:18: error:
Type mismatch:
  expected: <IO> Int
  inferred: Int
Cannot compare types Int and <IO> Int
  |
7 | notASuspension = 42
  |                  ^
```

The compiler names the fix in the other two cases. Narrowing:

```console
rule2.loc:12:5-15:1: error:
Type mismatch:
  expected: <IO> Int
  inferred: <IO,Net> Int
Subtype error: body performs effect(s) <Net> not in the declared type. Fix by declaring the missing effect(s) in the signature.
  <IO,Net> Int <: <IO> Int
   |
12 | | a = do
   | |     ^
13 | |   x <- readValue
14 | |   x
   | | ^
```

and dropping an effect into a pure slot:

```console
rule3.loc:10:5: error:
Type mismatch:
  expected: Int
  inferred: <IO> Int
Subtype error: an effectful value cannot be used where a non-effectful type is expected; bind it in a do-block first (x <- e) and pass the bound value, e.g. `do { x <- e ; f x }` instead of `f e`
  <IO> Int <: Int
   |
10 | b = readValue
   |     ^
```

## 3.17.5. Effect row variables

Combinators that **thread** effects need to be able to talk about sets of unknown effects. For that, an effect row may include a single lowercase variable that represents a set of zero or more unknown effects. `mapE` carries all the effects of the mapping function to the final value:

```morloc
mapE :: (a -> <e> b) -> [a] -> <e> [b]
```

Effect variables and constants may be mixed, but at most one effect variable can appear in a given effect row. So `<A,B,e>` is OK, but `<A,e,f>` is not.

In the following code, the signature requires that `f` may produce a `Rand` effect, and allows it to produce others as well:

```morloc
foo :: (Int -> <Rand,e> Int) -> Int -> <Rand,e> Int
foo f x = do
  y <- f x
  y * 2
```

```console
$ morloc typecheck rowvar.loc
foo :: (Int -> <Rand,e@e0> Int) -> Int -> <Rand,e@e0> Int
```

Had the signature said just `<Rand>`, only that effect would be permitted and any additional one would be a type error.

## 3.17.6. Escapable and inescapable effects

The default form `effect E` is **inescapable**. An inescapable effect that appears in a function’s arguments must also appear in its result. The compiler enforces this on every signature, sourced or defined.

```morloc
effect Cap                         -- inescapable

passt :: <Cap> Int -> <Cap> Int    -- OK: Cap propagates
bad   :: <Cap, e> a -> <e> a       -- ERROR: Cap dropped from result
```

```console
esc.loc:8:1: error:
Inescapable effect 'Cap' appear(s) in an argument but not in the result row. An inescapable effect performed via an argument must propagate to the result (only a sourced handler may discharge an escapable effect).
  |
8 | bad   :: <Cap, e> a -> <e> a
  | ^
```

Effects may alternatively be defined as **escapable**, which means a function may discharge the effect and drop it from the result row. Only a **sourced** function may do this, because discharging an effect means actually running the suspension — setting up whatever the effect needs, calling the computation inside that setup, and handing back a plain value. That is foreign-language work; there is nothing in Morloc itself that can do it.

Seeded sampling is the shape this fits. `roll` needs a random-number generator, and `withSeed` supplies one, so a call under `withSeed` is reproducible and no longer carries `Rand`:

```morloc
escapable effect Rand

source Py from "rnd.py" ("roll", "withSeed")

roll     :: Int -> <Rand> Int
withSeed :: Int -> <Rand> a -> a

runIt :: Int -> Int
runIt n = withSeed 42 (roll n)
```

**rnd.py**

```python
import random

def roll(n):
    return random.randint(1, n)

def withSeed(seed, thunk):
    random.seed(seed)
    return thunk()
```

```console
$ ./esc2 runIt 6
6
$ ./esc2 runIt 6
6
```

The handler receives the suspension as a callable and decides when to run it. Declare `Rand` without `escapable` and the same `withSeed` signature is rejected, because dropping the effect is exactly what an inescapable one forbids:

```console
esc3.loc:11:1: error:
Inescapable effect 'Rand' appear(s) in an argument but not in the result row. An inescapable effect performed via an argument must propagate to the result (only a sourced handler may discharge an escapable effect).
   |
11 | withSeed :: Int -> <Rand> a -> a
   | ^
```

Nothing in the standard library discharges an effect today; `escapable` is there for handlers you write.
