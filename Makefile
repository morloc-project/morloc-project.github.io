all:
	asciidoctor -r asciidoctor-bibtex --doctype=book index.adoc

clean:
	rm -r *pdf

setup:
	## can also try uninstalling stuff ... yay
	# gem uninstall asciidoctor-bibtex
	## installing these might help, just look through the --trace output and see what is missing
	# gem install rdoc
	# gem install rxml
	# gem install bibtex-ruby
	# gem install pygments.rb
	gem install asciidoctor-bibtex
