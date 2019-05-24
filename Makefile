all:
	asciidoctor -r asciidoctor-bibtex --doctype=book main.asc

clean:
	rm -r *pdf *html
