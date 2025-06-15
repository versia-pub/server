#!/usr/bin/env bash
set -euo pipefail

# Step 1: Run pnpm install
pnpm i --lockfile-only

# Step 2: Blank the hash in package.nix
sed -i 's/hash = ".*";/hash = lib.fakeHash;/g' nix/package.nix

echo "Running nix build to get the correct hash..."

# Step 3: Run nix build and capture stderr
build_output=$(nix build .#versia-server 2>&1 || true)

# Step 4: Extract the corrected hash from the output
corrected_hash=$(echo "$build_output" | grep 'got:' | awk '{print $2}')

echo "Corrected hash: $corrected_hash"

# Step 5: Replace the blank hash with the corrected one
sed -i "s/hash = lib.fakeHash;/hash = \"$corrected_hash\";/g" nix/package.nix

echo "Rebuilding with the corrected hash..."

# Step 6: Build again
nix build .#versia-server
