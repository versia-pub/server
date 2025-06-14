{
  lib,
  stdenv,
  pnpm,
  bun,
  nodejs,
  vips,
  makeWrapper,
  ...
}: let
  packageJson = builtins.fromJSON (builtins.readFile ../package.json);
in
  stdenv.mkDerivation (finalAttrs: {
    pname = packageJson.name;
    version = packageJson.version;

    src = ../.;

    # Fixes the build script mv usage
    pnpmInstallFlags = ["--shamefully-hoist"];

    pnpmDeps = pnpm.fetchDeps {
      inherit (finalAttrs) pname version src pnpmInstallFlags;
      hash = "sha256-/VCzDp8EfvQkaz/5W3rcoEyOlSB4zeW97qqOTJf6WvA=";
    };

    nativeBuildInputs = [
      pnpm
      pnpm.configHook
      bun
      nodejs
      makeWrapper
    ];

    buildInputs = [
      vips
    ];

    buildPhase = ''
      runHook preBuild

      bun run build

      runHook postBuild
    '';

    entrypointPath = "index.js";

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
        --add-flags "run $out/${finalAttrs.pname}/${finalAttrs.entrypointPath}" \
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
