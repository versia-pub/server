{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.services.versia-server;
  configFormat = pkgs.formats.toml {};
  name = "versia-server";

  inherit (lib.options) mkOption;
  inherit (lib.modules) mkIf;
in {
  options = {
    services.versia-server = {
      enable = mkOption {
        type = lib.types.bool;
        default = false;
        description = ''
          Enable the Versia Server services.
        '';
      };

      dataDir = mkOption {
        type = lib.types.path;
        default = "/var/lib/${name}";
        description = ''
          Directory where the server will store its data.
        '';
      };

      user = mkOption {
        type = lib.types.str;
        default = name;
        description = ''
          User under which the server will run.
        '';
      };

      group = mkOption {
        type = lib.types.str;
        default = name;
        description = ''
          Group under which the server will run.
        '';
      };

      nodes = {
        api = mkOption {
          type = lib.types.attrsOf (lib.types.submodule {
            options = {
              configOverrides = mkOption {
                type = lib.types.submodule {
                  freeformType = configFormat.type;
                  options = {};
                };
                default = {};
                description = "Overrides for the node's configuration file.";
              };
            };
          });
        };
        worker = mkOption {
          type = lib.types.attrsOf (lib.types.submodule {
            options = {
              configOverrides = mkOption {
                type = lib.types.submodule {
                  freeformType = configFormat.type;
                  options = {};
                };
                default = {};
                description = "Overrides for the node's configuration file.";
              };
            };
          });
        };
      };

      config = mkOption {
        type = lib.types.submodule {
          freeformType = configFormat.type;
          options = {};
        };
        description = "Contents of the config file, which is serialized to TOML. Check the Versia Server documentation for information on its contents.";
      };
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.nodes.api != [];
        message = "At least one API node must be defined.";
      }
      {
        assertion = cfg.nodes.worker != [];
        message = "At least one worker node must be defined.";
      }
    ];

    systemd.services =
      lib.mapAttrs' (nodeName: node: let
        type = "api";
        exe = lib.getExe pkgs.versia-server;
        config = lib.recursiveUpdate cfg.config node.configOverrides;
        configFile = configFormat.generate "config-${nodeName}.toml" config;
      in
        lib.nameValuePair "${name}-${type}-${nodeName}" {
          description = "Versia Server ${nodeName} (${type})";

          wantedBy = ["versia-server-root.target"];
          partOf = ["versia-server-root.target"];

          serviceConfig = {
            ExecStart = "${exe}";
            Type = "simple";
            Restart = "always";

            User = cfg.user;
            Group = cfg.group;

            StateDirectory = "${name}";
            StateDirectoryMode = "0700";
            RuntimeDirectory = "${name}";
            RuntimeDirectoryMode = "0700";

            # Set the working directory to the data directory
            WorkingDirectory = cfg.dataDir;

            StandardOutput = "journal";
            StandardError = "journal";
            SyslogIdentifier = "${name}";

            Environment = [
              "CONFIG_FILE=${configFile}"
            ];
          };
        }) (cfg.nodes.api)
      // lib.mapAttrs' (nodeName: node: let
        type = "worker";
        exe = lib.getExe pkgs.versia-server-worker;
        config = lib.recursiveUpdate cfg.config node.configOverrides;
        configFile = configFormat.generate "config-${nodeName}.toml" config;
      in
        lib.nameValuePair "${name}-${type}-${nodeName}" {
          description = "Versia Server ${nodeName} (${type})";

          wantedBy = ["versia-server-root.target"];
          partOf = ["versia-server-root.target"];

          serviceConfig = {
            ExecStart = "${exe}";
            Type = "simple";
            Restart = "always";

            User = cfg.user;
            Group = cfg.group;

            StateDirectory = "${name}";
            StateDirectoryMode = "0700";
            RuntimeDirectory = "${name}";
            RuntimeDirectoryMode = "0700";

            # Set the working directory to the data directory
            WorkingDirectory = cfg.dataDir;

            StandardOutput = "journal";
            StandardError = "journal";
            SyslogIdentifier = "${name}";

            Environment = [
              "CONFIG_FILE=${configFile}"
            ];
          };
        }) (cfg.nodes.worker);

    systemd.targets.versia-server-root = {
      description = "Versia Server root target, starts and stop all the child nodes.";
      wantedBy = ["multi-user.target"];
    };

    systemd.tmpfiles.rules = ["d ${cfg.dataDir} - - - - ${cfg.user} ${cfg.group}"];

    users = {
      groups = {
        "${cfg.group}" = {};
      };

      users = {
        "${cfg.user}" = {
          isSystemUser = true;
          group = cfg.group;
          home = cfg.dataDir;
          packages = [pkgs.versia-server pkgs.versia-server-worker];
        };
      };
    };
  };
}
