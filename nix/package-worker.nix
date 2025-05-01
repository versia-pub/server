# Simply edit the server to run "bun run build:worker" instead of "bun run build"
{versia-server, ...}:
versia-server.overrideAttrs (oldAttrs: {
  pname = "${oldAttrs.pname}-worker";
  buildPhase = ''
    runHook preBuild

    bun run build:worker

    runHook postBuild
  '';
  entrypointPath = "worker.js";

  meta =
    oldAttrs.meta
    // {
      description = "${oldAttrs.meta.description} (worker)";
    };
})
