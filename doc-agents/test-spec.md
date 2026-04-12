# Agentic testing spec for morloc docs

## Overall goals

The goal of this test framework is to ensure that the documentation of morloc
matches the current implementation. The goal is not to ensure all possible OS
configurations work (that is the focus of the morloc-manager test suite). Rather
we only test in one environment (fedora with rootful docker containers).

## Test setup with vagrant

The morloc-manager already has a working agentic test suite. We can build on
that. This test environment is simpler in some ways because we are testing in
just one environment. We will need a simple vagrant file describing the most
standard fedora server setup. The agents will need to ssh into the vm (as is
done in the morloc-manager tests).

## Agentic psuedocode

 * start the vm
 * for each agent persona
    * read the src/index.adoc file and find all included asciidocs files
    * study the documentation files (index.adoc + included files) in order and
      follow the instructions
    * follow the `getting-started.asc` instructions and setup morloc
    * run all code across all files
    * ensure the writing is consistent and clear and the code runs correctly
    * if any issues in the documentation text, write them into the
      `findings/<persona>/report.md` file.
    * if there are any bugs encountered when running morloc code, write an issue
      report at `findings/<persona>bug-NNN.md` file. Bugs can include failure to
      compile, bad error messages, etc.
 * after all personas have run, like in the morloc-manager tests, an analysis
   agent folds over results from all personas to make a final analysis document
   that include non-redundant descriptions of all issues and bugs.
