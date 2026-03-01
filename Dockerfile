FROM docker.io/library/ubuntu:24.04

# Install all system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ruby ruby-dev build-essential \
    python3 python3-pip \
    nodejs npm \
    wget gnupg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Create Chrome wrapper with Docker-safe flags
RUN echo '#!/bin/bash\nexec /usr/bin/google-chrome --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu "$@"' > /usr/local/bin/chrome \
    && chmod +x /usr/local/bin/chrome

# Install Node.js tools
RUN npm install -g @mermaid-js/mermaid-cli@^11.0.0

# Install Ruby gems
RUN gem install --no-document asciidoctor asciidoctor-bibtex pygments.rb asciidoctor-diagram

# Install custom lexer
RUN git clone https://github.com/morloc-project/pygmentize morloclexer
RUN pip install --break-system-packages ./morloclexer

# Configure Puppeteer to use our Chrome wrapper
ENV PUPPETEER_EXECUTABLE_PATH=/usr/local/bin/chrome

WORKDIR /documents
