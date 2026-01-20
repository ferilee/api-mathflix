FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
RUN bun install

# Copy source code
COPY . .

# Initialize DB if needed (optional, or handle in entrypoint)
# For now, we assume volume persistence

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
