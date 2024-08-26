{
  lib,
  fetchFromGitHub,
}: {
  outputHash.x86_64-linux = lib.fakeHash;
  outputHash.aarch64-linux = lib.fakeHash;
  src = fetchFromGitHub {
    owner = "lysand-org";
    repo = "server";
    rev = "fbe86043b7e276ab123f29c234d5ef6d9724536f";
    hash = "sha256-yUc/50rhYrPkldO77ujf2+CHujbxVzS/QBPfu7B07+8=";
  };
}
