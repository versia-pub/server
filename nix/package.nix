{
  lib,
  stdenv,
  fetchFromGitHub,
  bun,
  callPackage,
  nodeHashes ? callPackage ./nodeHashes.nix { inherit lib; },
  nodePackages_latest,
  makeBinaryWrapper,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "versiajs";
  version = "0.7.0";

  src = ../.;

  node_modules = stdenv.mkDerivation {
    pname = "${finalAttrs.pname}-node_modules";

    inherit (finalAttrs) version src; 

    nativeBuildInputs = with nodePackages_latest; [ bun nodejs typescript ];

    dontConfigure = true;

    buildPhase = ''
      bun install --production --no-progress --ignore-scripts --frozen-lockfile
    '';

    installPhase = ''
      mkdir -p $out/node_modules
      cp -r node_modules $out
    '';

    dontFixup = true;

    outputHash = nodeHashes.${stdenv.system};
    outputHashMode = "recursive";
  };

  nativeBuildInputs = [ bun ];

  buildInputs = [ bun nodePackages_latest.nodejs makeBinaryWrapper ];

  patches = [ ./fix-build-spinner.patch ];

  configurePhase = ''
    runHook preConfigure

    cp -r ${finalAttrs.node_modules}/node_modules .

    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild

    bun run build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    cp -r dist/ $out

    mkdir -p $out/bin

    makeBinaryWrapper ${bun}/bin/bun $out/bin/versiajs \
      --prefix PATH : ${lib.makeBinPath [ bun ]} \
      --set NODE_ENV "production" \
      --add-flags "run --prefer-offline --no-install --cwd $out $out/index.js"

    makeBinaryWrapper ${bun}/bin/bun $out/bin/versiajs-cli \
      --prefix PATH : ${lib.makeBinPath [ bun ]} \
      --add-flags "run --prefer-offline --no-install --cwd $out $out/cli/index.js"

    runHook postInstall
  '';

  meta = {
    description = "A new federated server written with TypeScript and Bun ";
    homepage = "https://lysand.org";
    license = with lib.licenses; [ agpl3Plus ];
    maintainers = with lib.maintainers; [ snaki ];
    platforms = [ "x86_64-linux" "x86_64-darwin" "aarch64-linux" "aarch64-darwin" ];
  };
})
