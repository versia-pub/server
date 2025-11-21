{
  lib,
  stdenv,
  bun,
  nodejs,
  vips,
  makeWrapper,
  stdenvNoCC,
  writableTmpDirAsHomeHook,
  ...
}: let
  packageJson = builtins.fromJSON (builtins.readFile ../package.json);
in
  stdenv.mkDerivation (finalAttrs: {
    pname = packageJson.name;
    version = packageJson.version;

    src = ../.;

    node_modules = stdenvNoCC.mkDerivation {
      pname = "${finalAttrs.pname}-node_modules";
      inherit (finalAttrs) version src;

      nativeBuildInputs = [
        bun
        nodejs
        writableTmpDirAsHomeHook
      ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild

         export BUN_INSTALL_CACHE_DIR=$(mktemp -d)

         bun install \
           --force \
           --frozen-lockfile \
           --no-progress

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall

        mkdir -p $out/node_modules
        cp -R ./node_modules $out

        runHook postInstall
      '';

      # Required else we get errors that our fixed-output derivation references store paths
      dontFixup = true;

      outputHash = "sha256-gr4R+S4OusBtQtlskzjS+FEtT2mKCXcr6jk7EInXXMo=";
      outputHashAlgo = "sha256";
      outputHashMode = "recursive";
    };

    nativeBuildInputs = [
      bun
      makeWrapper
    ];

    configurePhase = ''
      runHook preConfigure

      cp -R ${finalAttrs.node_modules}/node_modules .

      runHook postConfigure
    '';

    buildPhase = ''
      runHook preBuild

      bun run build ${finalAttrs.buildType}

      runHook postBuild
    '';

    buildType = "api";

    installPhase = let
      libPath = lib.makeLibraryPath [
        vips
        stdenv.cc.cc.lib
      ];

      binPath = lib.makeBinPath [
        bun
      ];
    in ''
      runHook preInstall

      mkdir -p $out
      cp -r dist $out/${finalAttrs.pname}

      makeWrapper ${lib.getExe bun} $out/bin/${finalAttrs.pname} \
        --add-flags "run $out/${finalAttrs.pname}/${finalAttrs.buildType}.js" \
        --set NODE_PATH $out/${finalAttrs.pname}/node_modules \
        --set MSGPACKR_NATIVE_ACCELERATION_DISABLED true \
        --prefix PATH : ${binPath} \
        --prefix LD_LIBRARY_PATH : ${libPath}


      runHook postInstall
    '';

    meta = with lib; {
      description = packageJson.description;
      homepage = packageJson.homepage;
      license = licenses.agpl3Only;
      maintainers = [
        {
          name = "CPlusPatch";
          email = "contact@cpluspatch.com";
          github = "CPlusPatch";
          githubId = 42910258;
          matrix = "@jesse:cpluspatch.dev";
        }
      ];
      platforms = ["x86_64-linux" "aarch64-linux"];
      mainProgram = finalAttrs.pname;
    };
  })
