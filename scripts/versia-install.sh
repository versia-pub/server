#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration variables
RANDOM_SUFFIX=$(head /dev/urandom | tr -dc 'a-z0-9' | head -c 8)
DOMAIN="versia-${RANDOM_SUFFIX}.localhost"
INSTALL_DIR="./versia-install-${RANDOM_SUFFIX}"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
CONFIG_FILE="${INSTALL_DIR}/config/config.toml"
VERSION="v0.7.0"
PORT=$(shuf -i 10000-65000 -n 1)

# Store container names
CONTAINER_PREFIX="versia-${RANDOM_SUFFIX}"
CONTAINER_NAMES=(
    "${CONTAINER_PREFIX}-server"
    "${CONTAINER_PREFIX}-fe"
    "${CONTAINER_PREFIX}-db"
    "${CONTAINER_PREFIX}-redis"
)

# Function to log messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

# Check for required commands
check_requirements() {
    local required_commands=("docker" "docker-compose" "curl" "mkcert")

    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error "$cmd is required but not installed. Please install it first."
        fi
    done
}

# Create necessary directories
setup_directories() {
    log "Creating installation directories..."
    mkdir -p "${INSTALL_DIR}"/{config,logs,uploads,store,redis-data,db-data}
}

# Generate SSL certificates using mkcert
setup_ssl() {
    log "Setting up SSL certificates..."

    # Initialize mkcert if not already done
    mkcert -install

    # Generate certificates for the domain
    cd "${INSTALL_DIR}"
    mkcert "${DOMAIN}"

    # Create nginx config directory if it doesn't exist
    mkdir -p "${INSTALL_DIR}/nginx"
}

# Download necessary files
download_files() {
    log "Downloading configuration files..."

    # Download docker-compose.yml
    curl -sSL "https://raw.githubusercontent.com/versia-pub/server/${VERSION}/docker-compose.yml" -o "${COMPOSE_FILE}"

    # Download config.example.toml
    curl -sSL "https://raw.githubusercontent.com/versia-pub/server/${VERSION}/config/config.example.toml" -o "${INSTALL_DIR}/config/config.example.toml"
}

# Generate random passwords
generate_passwords() {
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    REDIS_PASSWORD=$(openssl rand -base64 32)
}

# Configure Versia config.toml
configure_config_file() {
    log "Configuring config.toml..."

    cat > "${CONFIG_FILE}" << EOF
[database]
host = "db"
port = 5432
username = "versia"
password = "${POSTGRES_PASSWORD}"
database = "versia"

[redis.queue]
host = "redis"
port = 6379
password = "${REDIS_PASSWORD}"
database = 0
enabled = true

[redis.cache]
host = "redis"
port = 6379
password = "${REDIS_PASSWORD}"
database = 1
enabled = true

[sonic]
host = "sonic"
port = 1491
password = ""
enabled = false

[smtp]
# SMTP server to use for sending emails
server = "smtp.example.com"
port = 465
username = "test@example.com"
password = "password123"
tls = true
# Disable all email functions (this will allow people to sign up without verifying
# their email)
enabled = false

[filters]
# Regex filters for federated and local data
# Drops data matching the filters
# Does not apply retroactively to existing data

# Note contents
note_content = [
    # "(https?://)?(www\\.)?youtube\\.com/watch\\?v=[a-zA-Z0-9_-]+",
    # "(https?://)?(www\\.)?youtu\\.be/[a-zA-Z0-9_-]+",
]
emoji = []
# These will drop users matching the filters
username = []
displayname = []
bio = []

[ratelimits]
# These settings apply to every route at once
# Amount to multiply every route's duration by
duration_coeff = 1.0
# Amount to multiply every route's max requests per [duration] by
max_coeff = 1.0

[ratelimits.custom]
# Add in any API route in this style here
# Applies before the global ratelimit changes
# "/api/v1/accounts/:id/block" = { duration = 30, max = 60 }
# "/api/v1/timelines/public" = { duration = 60, max = 200 }

[signups]
registration = true
rules = [
    "Do not harass others",
    "Be nice to people",
    "Don't spam",
    "Don't post illegal content",
]

[http]
base_url = "https://${DOMAIN}:${PORT}"
bind = "0.0.0.0"
bind_port = ${PORT}

[http.tls]
enabled = true
key = "/app/dist/config/${DOMAIN}-key.pem"
cert = "/app/dist/config/${DOMAIN}.pem"

[frontend]
enabled = true
path = "/app/dist/frontend"

[media]
backend = "local"
deduplicate_media = true
local_uploads_folder = "uploads"

[media.conversion]
convert_images = true
convert_to = "image/webp"
convert_vector = false

[validation]
max_displayname_size = 50
max_bio_size = 5000
max_note_size = 5000
max_avatar_size = 5000000
max_header_size = 5000000
max_media_size = 40000000
max_media_attachments = 10
max_media_description_size = 1000
max_poll_options = 20
max_poll_option_size = 500
min_poll_duration = 60
max_poll_duration = 1893456000
max_username_size = 30
max_field_count = 10
max_field_name_size = 1000
max_field_value_size = 1000

[validation.challenges]
# "Challenges" (aka captchas) are a way to verify that a user is human
# Versia Server's challenges use no external services, and are Proof of Work based
# This means that they do not require any user interaction, instead
# they require the user's computer to do a small amount of work
enabled = false
# The difficulty of the challenge, higher is will take more time to solve
difficulty = 50000
# Challenge expiration time in seconds
expiration = 300 # 5 minutes
# Leave this empty to generate a new key
key = ""

[instance]
name = "Local Versia Instance"
description = "A local development instance of Versia Server"

[instance.keys]
public = "MCowBQYDK2VwAyEA39sO9bdtrZbyQ5+tKdQf4VIU/PY+Y5Zx7+3JL5Omxno="
private = "MC4CAQAwBQYDK2VwBCIEIMZXcDkHIqRFUmmZVw04l7nZjkzwlXfnQbH5iT1XCYVn"

[logging]
log_level = "debug"
log_ip = false

[logging.storage]
requests = "logs/requests.log"

[plugins.config."@versia/openid".keys]
public = "MCowBQYDK2VwAyEAfyZx8r98gVHtdH5EF1NYrBeChOXkt50mqiwKO2TX0f8="
private = "MC4CAQAwBQYDK2VwBCIEILDi1g7+bwNjBBvL4CRWHZpCFBR2m2OPCot62Wr+TCbq"
EOF
}

# Create a new docker-compose.yml with our modifications
create_docker_compose() {
    cat > "${COMPOSE_FILE}" << EOF
services:
  versia:
    image: ghcr.io/versia-pub/server:main
    volumes:
      - ./logs:/app/dist/logs
      - ./config:/app/dist/config
      - ./uploads:/app/dist/uploads
    restart: unless-stopped
    container_name: ${CONTAINER_NAMES[0]}
    tty: true
    ports:
      - ${PORT}:${PORT}
    networks:
      - ${CONTAINER_PREFIX}-net
    depends_on:
      - db
      - redis
      - fe

  fe:
    image: ghcr.io/versia-pub/frontend:main
    container_name: ${CONTAINER_NAMES[1]}
    restart: unless-stopped
    networks:
      - ${CONTAINER_PREFIX}-net
    environment:
      NUXT_PUBLIC_API_HOST: https://${DOMAIN}:${PORT}

  db:
    image: postgres:17-alpine
    container_name: ${CONTAINER_NAMES[2]}
    restart: unless-stopped
    environment:
      POSTGRES_DB: versia
      POSTGRES_USER: versia
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    networks:
      - ${CONTAINER_PREFIX}-net
    volumes:
      - ./db-data:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    container_name: ${CONTAINER_NAMES[3]}
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./redis-data:/data
    restart: unless-stopped
    networks:
      - ${CONTAINER_PREFIX}-net

networks:
  ${CONTAINER_PREFIX}-net:
EOF
}

# Function to create a new user and set password
create_user() {
    local username="$1"
    local password="$2"

    log "Creating user: ${username}"
    # Set the password using a heredoc to provide input
    docker exec -i "${CONTAINER_NAMES[0]}" /bin/sh /app/entrypoint.sh cli user create "${username}" --password "${password}"
}

# Configure the services
configure_services() {
    log "Configuring services..."

    # Configure config.toml
    configure_config_file

    # Create new docker-compose.yml with our modifications
    create_docker_compose

    # Copy SSL certificates to config directory
    cp "${INSTALL_DIR}/${DOMAIN}.pem" "${INSTALL_DIR}/config/"
    cp "${INSTALL_DIR}/${DOMAIN}-key.pem" "${INSTALL_DIR}/config/"
}

# Cleanup function
cleanup() {
    log "Cleaning up installation..."
    cd "${INSTALL_DIR}"
    docker-compose down -v
    rm -rf "${INSTALL_DIR}"
    log "Cleanup complete!"
}

# Function to handle SIGINT (Ctrl+C)
handle_interrupt() {
    log "Received interrupt signal. Cleaning up..."
    cleanup
    exit 0
}

# Main installation function
install_versia() {
    log "Starting Versia installation..."

    check_requirements
    setup_directories
    generate_passwords
    download_files
    setup_ssl
    configure_services

    # Start the services
    log "Starting Versia services..."
    cd "${INSTALL_DIR}"
    docker-compose up -d

    # Wait for services to be ready
    sleep 5

    # Create a default test user
    TEST_USER="testuser_${RANDOM_SUFFIX}"
    TEST_PASSWORD=$(openssl rand -base64 12)
    create_user "${TEST_USER}" "${TEST_PASSWORD}"

    log "Installation complete! Versia is now available at https://${DOMAIN}:${PORT}"
    log "Installation Details:"
    log "---------------------"
    log "Domain: ${DOMAIN}"
    log "Port: ${PORT}"
    log "Installation Directory: ${INSTALL_DIR}"
    log "Test User: ${TEST_USER}"
    log "Test Password: ${TEST_PASSWORD}"
    log "PostgreSQL Password: ${POSTGRES_PASSWORD}"
    log "Redis Password: ${REDIS_PASSWORD}"
    log "Container Names:"
    for name in "${CONTAINER_NAMES[@]}"; do
        log "  - ${name}"
    done
    log "---------------------"
    log "To create additional users, use:"
    log "docker-compose exec -it ${CONTAINER_NAMES[0]} /bin/sh /app/entrypoint.sh cli user create <username> --set-password"
    log "---------------------"
    log "Press Ctrl+C to stop and cleanup the installation"

    # Set up interrupt handler
    trap handle_interrupt SIGINT

    # Wait indefinitely
    while true; do
        sleep 1
    done
}

# Run the installation
install_versia
