all:
	asciidoctor-latex -b html --trace -r asciidoctor-bibtex main.adoc
	mv main.html index.html

clean:
	rm -r *pdf *html
