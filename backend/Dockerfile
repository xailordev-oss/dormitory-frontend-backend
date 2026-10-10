# =========================================================
# Stage 1: Build — compile TypeScript ເປັນ JavaScript
# =========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files ກ່ອນ ເພື່ອໃຫ້ Docker cache layer npm install ໄດ້
COPY package*.json ./
RUN npm ci

# Copy source ແລ້ວ build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# =========================================================
# Stage 2: Production — image ສຸດທ້າຍ ມີແຕ່ dist + dependencies ທີ່ຈຳເປັນ
# =========================================================
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# ຕິດຕັ້ງສະເພາະ production dependencies (ບໍ່ເອົາ devDependencies/tsx/typescript)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy ໂຄ້ດທີ່ compile ແລ້ວ ຈາກ stage build
COPY --from=builder /app/dist ./dist
# schema.sql (migrate ອ່ານ) + ໜ້າເວັບ (public/)
COPY database ./database
COPY public ./public

# ໂຟນເດີ້ເກັບຮູບພາບອັບໂຫລດ (ຄວນຜູກ volume ຢູ່ docker-compose ບໍ່ໃຫ້ຮູບຫາຍເມື່ອ restart)
RUN mkdir -p uploads/rooms uploads/buildings uploads/students uploads/misc

# ຮັນດ້ວຍ user ທີ່ບໍ່ແມ່ນ root ເພື່ອຄວາມປອດໄພ
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# ຍົກລະດັບ/ສ້າງຖານຂໍ້ມູນກ່ອນ (ແລ່ນຊ້ຳໄດ້ປອດໄພ) ແລ້ວຈຶ່ງເປີດ server
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/index.js"]
