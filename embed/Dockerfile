FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs ./
# Bake the model into the image so it starts offline.
RUN mkdir -p /models && node -e "import('@huggingface/transformers').then(async m=>{m.env.cacheDir='/models';await m.pipeline('feature-extraction','Xenova/multilingual-e5-small',{dtype:'q8'});})"
ENV NODE_OPTIONS=--max-old-space-size=256 HF_HUB_OFFLINE=1
USER node
EXPOSE 4400
CMD ["node","server.mjs"]
