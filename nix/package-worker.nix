# Simply edit the server to run "bun run build:worker" instead of "bun run build"
{versia-server, ...}:
versia-server.overrideAttrs (oldAttrs: {
  pname = "${oldAttrs.pname}-worker";
  buildPhase = ''
    runHook preBuild

    bun run packages/worker/build.ts

    runHook postBuild
  '';
  entrypointPath = "packages/worker/index.js";

  meta =
    oldAttrs.meta
    // {
      description = "${oldAttrs.meta.description} (worker)";
    };
})
