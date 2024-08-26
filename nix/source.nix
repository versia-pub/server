{
  lib,
  fetchFromGitHub,
}: {
  outputHash.x86_64-linux = "sha256-3rLmKyJLQ6hwOVdFt0AVonOfXj07usxqpchqlqfFa10=";
  outputHash.aarch64-linux = "sha256-HNgtt6nZlC9hFW6JqgAtWkMedHPg+ajTBJg7C0UaspI=";
  src = fetchFromGitHub {
    owner = "lysand-org";
    repo = "server";
    rev = "0ac540132aa3e51ea5464c40a92ce1edb5effdfe";
    hash = "sha256-J2//W/3+hXV2m/1ai3Y40zb1QKO4drv5MOhzDfqF0V8=";
  };
}
