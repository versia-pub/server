{
  lib,
  fetchFromGitHub,
}: {
  outputHash.x86_64-linux = "sha256-SbOgLEdrKA7MwkiUvmenXyfbwgrKsq3AYo4Rjlqn0YA=";
  outputHash.aarch64-linux = "sha256-KJBsOhtDOmW/EVFgZF1TNB5G7mSeRZs18zwZlh1MsUM=";
  src = fetchFromGitHub {
    owner = "lysand-org";
    repo = "server";
    rev = "832f72160f574f86c8a8897e5dcb3d6382d8192c";
    hash = "sha256-BaojznCj0WWA0KkDMLjjlYikwpn975arGLyd0lFBXm0=";
  };
}
