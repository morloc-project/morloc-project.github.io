all:
	asciidoctor -r asciidoctor-bibtex --doctype=book main.asc

clean:
	rm -r *pdf *html

setup:
	gem uninstall asciidcotor asciidoctor-bibtex
	gem install asciidcotor asciidoctor-bibtex
