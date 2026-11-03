FROM alpine:3 AS css

ARG TAILWIND_VERSION=4.3.3
ARG TARGETARCH

WORKDIR /src

RUN apk add --no-cache curl libstdc++ libgcc \
	&& ARCH=$([ "$TARGETARCH" = "arm64" ] && echo arm64 || echo x64) \
	&& curl -sSLo /usr/local/bin/tailwindcss "https://github.com/tailwindlabs/tailwindcss/releases/download/v${TAILWIND_VERSION}/tailwindcss-linux-${ARCH}-musl" \
	&& chmod +x /usr/local/bin/tailwindcss

COPY . .

RUN tailwindcss -i ./css/input.css -o ./css/output.css --minify

FROM nginx:stable-alpine-slim

WORKDIR /usr/share/nginx/html

COPY --from=css /src/index.html ./
COPY --from=css /src/assets ./assets
COPY --from=css /src/js ./js
COPY --from=css /src/css/output.css ./css/output.css

EXPOSE 80
