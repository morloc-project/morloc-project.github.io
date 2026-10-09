# 13.5. Packet protocol

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-packets.html | prev: https://morloc-project.github.io/docs/build-architecture/build-workers.md | next: https://morloc-project.github.io/docs/build-architecture/build-shm.md

> Every message between Morloc processes is a **packet**: a fixed 32-byte header, optional metadata, and a payload. The same format carries calls, results, errors and readiness pings over sockets, and it is also the on-disk format of streams and cached results. This section specifies the header, each packet type, metadata blocks, how a payload names its data, and the transport rules.

**Layout.** A packet is a header, then `offset` bytes of metadata, then `length` bytes of payload. All integers are little-endian.

| Offset | Size | Field | Meaning |
| --- | --- | --- | --- |
| 0 | 4 | magic | `0x0707f86d` (bytes `6d f8 07 07`). A packet without it is rejected. |
| 4 | 2 | plain | Reserved, 0. |
| 6 | 2 | version | Reserved, 0. |
| 8 | 2 | flavor | Reserved, 0. |
| 10 | 2 | mode | Reserved, 0. |
| 12 | 8 | command | Packet type (first byte) and type-specific fields. |
| 20 | 4 | offset | Bytes of metadata between the header and the payload. |
| 24 | 8 | length | Bytes of payload. |

**Packet types**, from the first command byte:

| Type | Name | Purpose |
| --- | --- | --- |
| 0 | data | A value, or an error. |
| 1 | call | A function call: which function, and its arguments. |
| 2 | ping | Readiness check. The header alone; the reply is an identical ping. |
| 3 | stream | Opens a stream file; the length field is all ones, since a stream has no fixed length ([Streaming and memory mapping](https://morloc-project.github.io/docs/build-architecture/build-streaming.md)). |
| 4 | footer | Closes a stream file with its index ([Streaming and memory mapping](https://morloc-project.github.io/docs/build-architecture/build-streaming.md)). |

A **call** carries the function’s index inside the receiving pool (the `mid` from the manifest) as a 32-bit integer at byte 16, and an entry-point byte at byte 13: 0 for an ordinary call, 1 for a call read from a file, as on a cluster node. Its payload is the arguments, each a complete data packet, concatenated in order. The receiver walks them by their own sizes.

A **data** packet describes its payload in the command field:

| Byte | Field | Values |
| --- | --- | --- |
| 13 | source | 0 inline: the payload is the value. 1 file: the payload is a path. 2 pointer: the payload is an 8-byte relative pointer into shared memory ([Shared memory layout](https://morloc-project.github.io/docs/build-architecture/build-shm.md)). |
| 14 | format | 0 JSON, 1 MessagePack, 2 text, 3 packet (the file is itself a packet or stream), 4 voidstar ([Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md)), 5 Arrow ([Tables and tensors on the wire](https://morloc-project.github.io/docs/build-architecture/build-tables.md)). |
| 15 | compression | 0 none, 1 Zstandard. |
| 16 | encryption | Reserved, 0. |
| 17 | status | 0 pass, 1 fail, 2 output pipe closed. |

Not every combination is meaningful. Values crossing between pools use inline or pointer voidstar; tables use pointer Arrow; values in temporary files (shared memory disabled) use file MessagePack.

**Errors** are data packets with status 1, inline source and text format; the payload is the error message, including its cross-language traceback ([Error propagation](https://morloc-project.github.io/docs/build-architecture/build-errors.md)). Status 2 marks a write to a closed standard output, so the nexus can end the run with the conventional broken-pipe status instead of an error. A pool answers every call with exactly one packet: a request it cannot even read is answered with an error packet rather than silence.

**Metadata** is a sequence of blocks. Each block is the three bytes `mmh`, a one-byte kind, a 32-bit body size, then the body. Readers stop at the first block that does not start with `mmh`, and the region is zero-padded to a multiple of 32 bytes.

| Kind | Name | Body |
| --- | --- | --- |
| 1 | schema | The schema string of the payload’s type, NUL-terminated ([Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md)). |
| 3 | volume index | A 16-bit shared-memory volume index. |
| 4 | frame index | Sizes of the payload’s compressed frames; required when compression is Zstandard. |
| 5 | subpacket index | Offsets and element counts of a stream’s batches. |
| 6, 7, 8 | stream diagnostics, final footer, footer status | Used only in stream files ([Streaming and memory mapping](https://morloc-project.github.io/docs/build-architecture/build-streaming.md)). |

A packet between pools needs no schema block, because both sides know the type from the compiled program. Packets written to disk carry one, so that any tool can read them without the program that wrote them.

**Transport.** Packets travel over Unix-domain stream sockets. Each call opens one connection, sends one call packet, reads one reply packet, and closes. There is no separate framing: the receiver reads the 32-byte header and then exactly `offset + length` more bytes. Before a pointer payload is sent, the sender takes a shared-memory reference on the receiver’s behalf, so the block cannot be freed in the gap before the receiver reads it; if the send fails, the sender drops that reference again.

A caller waits for a reply as long as the callee lives, with no deadline: a call may legitimately run for days. A pool reading a request waits as long as the sending process exists, checking once a second.
