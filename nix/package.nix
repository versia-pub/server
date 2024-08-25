{
  lib,
  stdenv,
  bun,
  callPackage,
  modulesSrc ? callPackage ./source.nix {},
  nodePackages_latest,
  makeBinaryWrapper,
}:

assert lib.assertMsg (
  with builtins; hashFile "sha256" ../bun.lockb == hashFile "sha256" "${modulesSrc.src}/bun.lockb"
  ) "bun.lockb has changed. Please run 'nix run .#apps.x86_64-linux.update-modules'";

stdenv.mkDerivation (finalAttrs: {
  pname = "versiajs";
  version = "0.7.0";

  src = ../.;

  versiajsModules = stdenv.mkDerivation (modulesAttrs: {
    pname = "${finalAttrs.pname}-modules";

    inherit (finalAttrs) version; 

    src = modulesSrc.src;

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

    outputHash = modulesSrc.outputHash.${stdenv.system};
    outputHashMode = "recursive";
  });

  nativeBuildInputs = [ bun ];

  buildInputs = [ bun nodePackages_latest.nodejs makeBinaryWrapper ];

  patches = [ ./fix-build-spinner.patch ];

  configurePhase = ''
    runHook preConfigure

    cp -r ${finalAttrs.versiajsModules}/node_modules .

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

  passthru.updateScript = ./update.sh;

  meta = {
    description = "A new federated server written with TypeScript and Bun ";
    homepage = "https://lysand.org";
    license = with lib.licenses; [ agpl3Plus ];
    maintainers = with lib.maintainers; [ snaki ];
    platforms = [ "x86_64-linux" "aarch64-linux" ];
  };
})
