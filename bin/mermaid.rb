# Renders [mermaid] blocks to SVG through a Kroki server, once per site theme.
# The page shows the image matching html.dark (see style.css).
#
# Rendered SVGs are kept in the mermaid-cache-dir directory, named by the
# hash of the themed source, so a build only contacts the server for new or
# changed diagrams. A response that is not a 2xx SVG fails the build.

require 'asciidoctor/extensions'
require 'digest'
require 'fileutils'
require 'net/http'
require 'uri'

class MermaidBlock < Asciidoctor::Extensions::BlockProcessor
  use_dsl
  named :mermaid
  on_contexts :listing, :literal

  THEMES = { 'light' => 'default', 'dark' => 'dark' }.freeze

  def process(parent, reader, attrs)
    doc = parent.document
    where = reader.cursor_at_mark.to_s
    source = reader.read_lines.join("\n")
    alt = attrs['alt'] || attrs['title'] || 'Diagram'

    wrapper = create_open_block(parent, nil, { 'role' => 'diagram' })
    wrapper.title = attrs['title'] if attrs['title']

    THEMES.each do |name, theme|
      text = %(%%{init: {"theme": "#{theme}"}}%%\n#{source})
      file = "mermaid-#{Digest::SHA256.hexdigest(text)[0, 32]}.svg"
      install(doc, file, text, where)
      wrapper << create_image_block(wrapper, {
        'target' => file,
        'alt' => alt,
        'role' => "diagram-#{name}"
      })
    end

    wrapper
  end

  private

  def install(doc, file, text, where)
    cache_dir = doc.normalize_system_path(doc.attr('mermaid-cache-dir', 'diagrams'))
    cached = File.join(cache_dir, file)

    unless File.exist?(cached)
      svg = render(doc.attr('mermaid-server-url', 'https://kroki.io'), text, where)
      FileUtils.mkdir_p(cache_dir)
      File.write("#{cached}.tmp", svg, mode: 'wb')
      File.rename("#{cached}.tmp", cached)
    end

    to_dir = doc.attr('outdir') || doc.options[:to_dir]
    raise "mermaid diagram at #{where}: no output directory; pass -o or -D" unless to_dir

    out_dir = File.join(to_dir, doc.attr('imagesdir', ''))
    FileUtils.mkdir_p(out_dir)
    FileUtils.cp(cached, File.join(out_dir, file))
  end

  ATTEMPTS = 4

  def render(server, text, where)
    uri = URI("#{server.chomp('/')}/mermaid/svg")
    failure = nil

    ATTEMPTS.times do |attempt|
      sleep(5 * attempt)
      begin
        http = Net::HTTP.new(uri.hostname, uri.port)
        http.use_ssl = uri.scheme == 'https'
        http.open_timeout = 15
        http.read_timeout = 120
        res = http.post(uri.path, text, { 'Content-Type' => 'text/plain' })
      rescue Net::OpenTimeout, Net::ReadTimeout, SystemCallError => e
        failure = e.message
        next
      end

      body = res.body.to_s
      return body if res.is_a?(Net::HTTPSuccess) && body.include?('<svg')

      failure = "answered #{res.code}: #{body[0, 300]}"
      break unless res.is_a?(Net::HTTPServerError)
    end

    raise "mermaid diagram at #{where}: #{uri} #{failure}"
  end
end

Asciidoctor::Extensions.register do
  block MermaidBlock
end
