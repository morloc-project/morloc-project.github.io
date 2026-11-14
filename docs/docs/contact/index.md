# 18. Status and Contact

Morloc Manual | https://morloc-project.github.io/docs/contact/ | prev: https://morloc-project.github.io/docs/ai-policy/index.md

This is a young project and any brave early users are highly valued. Feel free to contact me for any reason!

-   github: [https://github.com/morloc-project/morloc](https://github.com/morloc-project/morloc)
-   discord: [https://discord.gg/dyhKd9sJfF](https://discord.gg/dyhKd9sJfF)
-   X: [https://x.com/morlocproject](https://x.com/morlocproject)
-   BlueSky: [https://bsky.app/profile/morloc-project.bsky.social](https://bsky.app/profile/morloc-project.bsky.social)
-   email: [z@morloc.io](mailto:z@morloc.io)

## 18.1. Where the project stands

Morloc has been in development for about ten years. I use it for my own work, but it is not yet widely used by others. The core features are all present. My current work is the long tail of edge cases and design optimization.

The compiler and basic type system are mostly complete, though the more advanced types still need work. Workflow features — provenance management, re-entrancy, caching, and job deployment — are working as prototypes, but need refinement and much broader support. Environment management, dependency handling and deployment are well developed through `mim`.

Beyond the compiler, the core libraries are slim and need very careful design. Language support also needs to be streamlined and extended to new languages. Zig is the next language on my list, though at some point I should add boring languages like JavaScript.

## 18.2. What I need

I’m looking for people who can:

-   **Write a module.** Take your program, give it types, and publish it.
-   **Report what breaks.** A bug report is worth more to me than a patch right now. Unexpected behavior, a bad error message, a gap in this manual, and anything that was harder than it should have been all count.
-   **Fix the editor tooling.** Add support for your favorite editor.
-   **Bring a language.** Every new language brings fun design questions, and I would be happy to work with you on bringing yours into the Morloc ecosystem.
-   **Tell me the right way to build a type system.** There is a lot of interesting theory to hash through. There’s a paper or two buried somewhere in all of this.
