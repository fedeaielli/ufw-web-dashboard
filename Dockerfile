FROM node:22-bookworm-slim

# ufw + its iptables/iproute2 dependencies, needed to manage the host firewall
RUN apt-get update \
    && apt-get install -y --no-install-recommends ufw iptables iproute2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY src ./src

ENV NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT=3300

EXPOSE 3300

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3300)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
