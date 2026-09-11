FROM rust:1-bookworm AS builder
WORKDIR /src
COPY . .
RUN cargo build --release -p sdkwork-api-skills-standalone-gateway

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /src/target/release/sdkwork-api-skills-standalone-gateway /usr/local/bin/sdkwork-api-skills-standalone-gateway
ENV SDKWORK_SKILLS_APPLICATION_PUBLIC_INGRESS_BIND=0.0.0.0:18092
EXPOSE 18092
CMD ["sdkwork-api-skills-standalone-gateway"]
