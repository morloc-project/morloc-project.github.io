all:
	asciidoctor-latex -b html --trace -r asciidoctor-bibtex main.adoc
	mv main.html index.html

clean:
	rm -r *pdf *html

.PHONY: asciidoctor
asciidoctor:
	gem uninstall asciidoctor asciidoctor-bibtex asciidoctor-latex
	gem install asciidoctor -v 1.5.2
	gem install asciidoctor-bibtex -v 0.1.0
	gem install pygments.rb
	gem install asciidoctor-latex --pre
