{
  lib,
  fetchFromGitHub,
}: {
  outputHash.x86_64-linux = lib.fakeHash;
  outputHash.aarch64-linux = lib.fakeHash;
  src = fetchFromGitHub {
    owner = "lysand-org";
    repo = "server";
    rev = "fbb845f7f8ee97e51ff57edba3817224341d3078";
    hash = "sha256-pc5t6z/AE+NPZEzXxTlzT76jq5PF7Mvjh94A0NCBDh8=";
  };
}
