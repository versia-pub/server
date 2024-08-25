#!/usr/bin/env nix-shell
#! nix-shell -i bash -p nix-prefetch-github

set -euo pipefail

SOURCE=$(nix-prefetch-github --nix lysand-org server | tail -n 6)

cat > ./nix/source.nix << EOF
{
  lib,
  fetchFromGitHub,
}: {
  outputHash.x86_64-linux = lib.fakeHash;
  outputHash.aarch64-linux = lib.fakeHash;
  src = fetchFromGitHub {
${SOURCE};
}
EOF

echo "Done."
echo "Please update the attributes of 'outputHash' in nix/source.nix."
