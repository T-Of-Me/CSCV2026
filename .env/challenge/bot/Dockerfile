FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /bot
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY bot.js ./
USER pwuser
EXPOSE 3001
CMD ["node", "bot.js"]

