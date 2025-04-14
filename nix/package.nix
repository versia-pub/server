{
  lib,
  stdenv,
  pnpm,
  bun,
  nodejs,
  vips,
  makeWrapper,
}: let
  packageJson = builtins.fromJSON (builtins.readFile ../package.json);
in
  stdenv.mkDerivation (finalAttrs: {
    pname = packageJson.name;
    version = packageJson.version;

    src = ../.;
    patches = [./fix-build-spinner.patch];

    # Fixes the build script mv usage
    pnpmInstallFlags = ["--shamefully-hoist"];

    pnpmDeps = pnpm.fetchDeps {
      inherit (finalAttrs) pname version src pnpmInstallFlags;
      hash = "sha256-As7RBxTWgk8HlWr4/xn2j3rqf3N7r0VvFGMbMHjyCKA=";
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
        --add-flags "run $out/${finalAttrs.pname}/index.js" \
        --set NODE_PATH $out/${finalAttrs.pname}/node_modules \
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
