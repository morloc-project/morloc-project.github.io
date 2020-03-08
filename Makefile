all:
	asciidoctor -r asciidoctor-bibtex --doctype=book main.asc

clean:
	rm -r *pdf

setup:
	gem uninstall asciidcotor asciidoctor-bibtex
	gem install asciidoctor asciidoctor-bibtex
