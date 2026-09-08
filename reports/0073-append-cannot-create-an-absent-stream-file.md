# 0073: `@append` cannot create an absent file, and the idiom that works around it truncates

- Status: open
- Found: 2026-09-08, while working the TODO-list findings
- Component: runtime
- morloc: 0.102.1     mim: 0.29.0

## Expected

`@append` opens a stream file for writing at its end. Starting an append-only
log should not need a different intrinsic than extending one -- an author
writes `@append f` once and the first call creates the file.

## Observed

Appending to a path that does not exist is an error:

```
$ ./ap app /tmp/log.pkt 1     # file does not exist yet
Error: evaluation failed: IO error: No such file or directory (os error 2)
```

So the create-if-absent idiom has to be written with a fallback, and the only
thing available to fall back to is `@open`, which truncates:

```morloc
appOrNew :: Str -> Int -> <IO, Err> ()
appOrNew p x = do
  o <- @catch (@append p) (@open p :: <IO, Err> OStream Int)
  @write 0 o [x]
  @close o
```

That fallback fires for *every* reason an append can fail, not just absence.
Here the element type does not match what the file holds:

```
$ for i in 1 2 3; do ./ap2 appOrNew /tmp/log2.pkt $i; done
$ ./ap2 count /tmp/log2.pkt
3
$ ./ap2 appStr /tmp/log2.pkt hello     # wrong element type
$ ./ap2 count /tmp/log2.pkt
1
```

Three elements became one. Nothing was printed and the exit status was zero.

## Reproduce

From an empty directory, `import root` only -- no pool is needed.

```morloc
module ap2 (appOrNew, appStr, count)
import root

appOrNew :: Str -> Int -> <IO, Err> ()
appOrNew p x = do
  o <- @catch (@append p) (@open p :: <IO, Err> OStream Int)
  @write 0 o [x]
  @close o

appStr :: Str -> Str -> <IO, Err> ()
appStr p s = do
  o <- @catch (@append p) (@open p :: <IO, Err> OStream Str)
  @write 0 o [s]
  @close o

count :: Str -> <IO, Err> Int
count p = do
  f <- @open p :: <IO, Err> IFile [Int]
  n <- @flen f
  @close f
  n
```

```
$ morloc make -o ap2 ap2.loc
$ for i in 1 2 3; do ./ap2 appOrNew /tmp/log2.pkt $i; done
$ ./ap2 count /tmp/log2.pkt      # 3
$ ./ap2 appStr /tmp/log2.pkt hello
$ ./ap2 count /tmp/log2.pkt      # 1
```

## Impact

An append-only log is the one design that never does read-modify-write, so it
is the design an author picks precisely to avoid a lost-update window. It loses
data anyway, silently and with a zero exit status, the first time an append
fails for any reason other than the file being absent -- a change to the element
record between two versions of the tool, a permissions problem, a partial
previous write.

## Guess

Unverified, but the shape is small: the append path begins by mapping the file
read-only to find its resume offset, so a missing file fails before anything
else is considered. `@append` is already handed the schema it would need to
create the file. Creating on absence, and leaving every other failure an error,
removes the reason anyone writes the truncating fallback.
