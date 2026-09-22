# 14. Future Directions

Morloc Manual | https://morloc-project.github.io/docs/future/ | prev: https://morloc-project.github.io/docs/internals/runtime-and-dev-builds.md | next: https://morloc-project.github.io/docs/qa/index.md

## 14.1. Planes of libraries

> **Important**
> The infrastructure for "planes" is not yet constructed, so the following is speculative

The concept of "planes" is central to the future organization of Morloc and is one of the primary reasons that I created it. A **plane** is like a namespace for a community’s modules—​but instead of organizing by category or programming language, modules in a plane share a common philosophy about quality, trustworthiness, software design and the review process.

Currently, the universe of functions is separated first by language and then by subject area. Morloc, being polyglot, allows the first mode of separation to be lifted, so language does not need to separate communities. Instead, communities can organize around **values**.

-   **Levels of review & trust:** Code may be wild and experimental; tightly reviewed and trusted in production; or formally verified.
-   **Design philosophy:** Groups may prioritize safety, raw performance, or elegance by some metric.
-   **Use case:** Planes may focus on production, pedagogy, competition or experimentation.

Making these differences explicit (and easy to navigate) lets the community set and find their own standards.

**Real-World Analogs**

Within the R community, you could define three planes:

-   **CRAN:** Has stringent requirements for acceptance and manual application process focused on adherence to well-defined (mostly automated) requirements
-   **rOpenSci:** Focuses on a formal peer review process that considers motivation, documentation, and good software design
-   **GitHub:** Wild west. Anything goes.

You could probably find more "planes" in R, but these three capture the idea of what a plane is. It is a design philosophy and set of protocols that define admission.

**Possible examples of Morloc planes**

-   **default**: Official libraries used in sandboxes and demos (not necessarily efficient).
-   **unstable**: For newly submitted or unvetted modules, e.g., loaded straight from GitHub.
-   **safe**: Modules that passed manual review, rigorous automated tests, and have strong test suites.
-   **true**: Formally verified modules, strict on what languages are allowed (e.g., dependently typed languages).
-   **prod**: Production ready modules, combining safety and performance.
-   **comp**: Modules suited for competitive programming; all performance, no safety checks or focus on software design principles.
-   **red**: Adversarial modules—​written to give the Morloc bot problems. Probably don’t want to import these.
-   **weird**: Esoteric code. For silly implementations that abuse languages in fun ways.
-   **demo**: Prototypes, examples, and proof-of-concept modules. More pedagogical than practical.

Planes aren’t rigid categories, but cultures: each has its own ground rules, review process, and ideas about what makes code "good". Anyone can propose a new plane, but we don’t want too many; a bit of consensus is required before adding one.

**How Does a Module Join a Plane?**

Again, the architecture is in development. But here is the basic process:

1.  **Register:** Authors register their module (e.g., import code from GitHub and authenticate).
2.  **AI Vetting:** Our AI (Weena) checks code for basic standards.
3.  **Acceptance:** After being accepted, the module defaults to the `unstable` plane.
4.  **Level Up:** Module authors can then apply to join other planes. Getting accepted depends on the plane’s review process (could be peer review, automated testing, thumbs up from community members, or nothing at all).
5.  **Multiple Planes:** Modules can exist in multiple planes at once—​different communities may trust the same code for different reasons.

This process will eventually be mediated on the website morloc.io (under construction).

Overall, planes help you find code that matches your needs and values—​whether you want ultimate safety, bleeding-edge performance, or just something weird that might surprise you. They also provide community and allow relations between different codebases to be specified.
