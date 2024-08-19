{ lib }: {
  x86_64-linux = "sha256-T/U9altP5HFzmULtsuvHQIXQXDCmQEAau8KFN8J5i/8=";
  x86_64-darwin = lib.fakeHash;
  aarch64-linux = "sha256-6ZzrYI2G+7q9Efgu5iKhZB3bT2C7T5fk4I/t5glpQYA=";
  aarch64-darwin = lib.fakeHash;
}
