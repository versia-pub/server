# Simply edit the server to run "bun run build:worker" instead of "bun run build"
{versia-server, ...}:
versia-server.overrideAttrs (oldAttrs: {
  pname = "${oldAttrs.pname}-worker";

  buildType = "worker";

  meta =
    oldAttrs.meta
    // {
      description = "${oldAttrs.meta.description} (worker)";
    };
})
