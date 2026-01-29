FROM node:18-bullseye AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_POS_API_BASE_URL=/api
ARG VITE_GEMINI_API_KEY=
ENV VITE_POS_API_BASE_URL=$VITE_POS_API_BASE_URL
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
RUN npm run build

FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
