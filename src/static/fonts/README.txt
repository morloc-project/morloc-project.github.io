Montserrat and PT Mono, self-hosted so the manual fetches nothing from a
third-party origin before it paints.

The woff2 files are the subsets Google Fonts serves for

  https://fonts.googleapis.com/css2?family=PT+Mono&family=Montserrat&display=swap

taken unmodified, one file per subset, 400 weight only. The @font-face rules
that name them, with the same unicode-ranges, are in ../css/fonts.css.

Both families are licensed under the SIL Open Font License 1.1; the license
text as published with each family is in OFL-Montserrat.txt and
OFL-PT-Mono.txt.
