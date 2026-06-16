FROM ghcr.io/puppeteer/puppeteer:latest

# Bỏ qua việc tải lại Chromium vì image này đã có sẵn
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# Chuyển quyền sở hữu cho user pptruser (người dùng mặc định của image puppeteer)
COPY --chown=pptruser:pptruser package*.json ./
RUN npm ci

COPY --chown=pptruser:pptruser . .

# Expose port (Render sẽ tự cung cấp PORT)
EXPOSE 3000

CMD ["node", "server.js"]
