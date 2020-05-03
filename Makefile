all:
	asciidoctor -r asciidoctor-bibtex --doctype=book index.adoc

clean:
	rm -r *pdf

setup:
	gem uninstall asciidcotor asciidoctor-bibtex
	gem install asciidoctor asciidoctor-bibtex
