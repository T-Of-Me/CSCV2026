FROM node:22-bookworm-slim
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY app.js worker.js ./
COPY flag.txt /flag
RUN useradd --system --uid 10001 renderer \
    && cp /usr/bin/cat /readflag \
    && chown root:root /flag /readflag \
    && chmod 0400 /flag \
    && chmod 4755 /readflag \
    && chown -R renderer:renderer /srv
USER renderer
EXPOSE 5000
CMD ["node", "app.js"]
